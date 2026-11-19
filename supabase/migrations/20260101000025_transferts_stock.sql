-- Transfert de stock entre deux boutiques de la même organisation (suite de la migration 23).
-- Un transfert est une sortie dans la boutique d'origine et une entrée dans la boutique de destination, écrites dans
-- la même transaction : tout réussit ou rien n'est écrit. Réservé au propriétaire, comme tout mouvement de stock.
-- Un transfert n'est ni une perte (qui fausserait les statistiques) ni une entrée d'achat (qui changerait le prix d'achat).

alter table mouvements_stock drop constraint mouvements_stock_type_check;
alter table mouvements_stock add constraint mouvements_stock_type_check
  check (type in ('entree', 'vente', 'retour', 'perte', 'inventaire', 'correction', 'transfert_sortie', 'transfert_entree'));

-- Historique : une ligne par transfert, avec une copie des lignes (noms et quantités figés, comme un reçu).
create table transferts_stock (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_source uuid not null references boutiques(id),
  boutique_destination uuid not null references boutiques(id),
  cle_idempotence uuid not null,
  note text,
  lignes jsonb not null,
  auteur_id uuid,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint transfert_boutiques_differentes check (boutique_source <> boutique_destination),
  constraint transfert_cle_unique unique (organisation_id, cle_idempotence)
);
create index on transferts_stock (organisation_id, cree_le desc);
alter table transferts_stock enable row level security;
grant select on transferts_stock to authenticated;
create policy lecture on transferts_stock for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire');
create trigger trg_immuable before update or delete on transferts_stock
  for each row execute function interdire_modification();

-- p_lignes : [{ "produit_id": uuid, "unite_id": uuid | null, "quantite": nombre > 0 }]
create function transferer_stock(p_source uuid, p_destination uuid, p_lignes jsonb, p_cle uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres; m2 membres; v_id uuid; v_ordonnees jsonb; l jsonb; r jsonb;
  v_prod produits; v_unite_nom text; v_facteur numeric; v_qte numeric; v_base numeric; v_dispo numeric;
  v_premier uuid; v_second uuid; v_vus uuid[] := '{}'; v_pid uuid; v_resume jsonb := '[]'::jsonb;
  v_de text; v_vers text; v_apercu text;
begin
  m := exiger_acces(p_source);
  m2 := exiger_acces(p_destination);
  perform verifier_ecriture(m.organisation_id);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut transférer du stock.'; end if;
  if m.organisation_id <> m2.organisation_id then raise exception 'Boutique introuvable.'; end if;
  if p_source = p_destination then raise exception 'Choisissez deux boutiques différentes.'; end if;
  if p_cle is null then raise exception 'Clé d''idempotence manquante.'; end if;
  if length(coalesce(p_note, '')) > 200 then raise exception 'Cette note est trop longue (200 caractères maximum).'; end if;

  select id into v_id from transferts_stock where organisation_id = m.organisation_id and cle_idempotence = p_cle;
  if found then return jsonb_build_object('id', v_id, 'deja_enregistre', true); end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Ajoutez au moins un produit à transférer.';
  end if;
  if jsonb_array_length(p_lignes) > 100 then raise exception 'Un transfert est limité à 100 produits.'; end if;

  -- Toujours dans le même ordre (par produit, puis par boutique) : deux transferts simultanés en sens inverse
  -- verrouillent les mêmes lignes dans le même ordre et ne peuvent pas se bloquer l'un l'autre.
  select jsonb_agg(e order by e ->> 'produit_id') into v_ordonnees from jsonb_array_elements(p_lignes) e;
  v_premier := least(p_source, p_destination);
  v_second := greatest(p_source, p_destination);

  for l in select value from jsonb_array_elements(v_ordonnees) loop
    begin
      v_pid := (l ->> 'produit_id')::uuid;
      v_qte := (l ->> 'quantite')::numeric;
    exception when others then
      raise exception 'Ligne de transfert invalide.';
    end;
    if v_qte is null or v_qte <= 0 or v_qte <> round(v_qte, 3) then raise exception 'Quantité invalide : elle doit être supérieure à zéro, avec 3 décimales au plus.'; end if;
    if v_pid = any (v_vus) then raise exception 'Un produit ne peut figurer qu''une fois dans un transfert.'; end if;
    v_vus := v_vus || v_pid;
    select * into v_prod from produits where id = v_pid and organisation_id = m.organisation_id and archive_le is null;
    if not found then raise exception 'Produit introuvable.'; end if;
    v_facteur := 1;
    v_unite_nom := v_prod.unite_base;
    if nullif(l ->> 'unite_id', '') is not null then
      select facteur, nom into v_facteur, v_unite_nom from produit_unites
       where id = (l ->> 'unite_id')::uuid and produit_id = v_pid and archive_le is null;
      if not found then raise exception 'Unité introuvable pour « % ».', v_prod.nom; end if;
    end if;
    v_base := v_qte * v_facteur;

    insert into stock_courant (produit_id, boutique_id, organisation_id, quantite)
    values (v_pid, p_source, m.organisation_id, 0), (v_pid, p_destination, m.organisation_id, 0) on conflict do nothing;
    perform 1 from stock_courant where produit_id = v_pid and boutique_id = v_premier for update;
    perform 1 from stock_courant where produit_id = v_pid and boutique_id = v_second for update;
    select quantite into v_dispo from stock_courant where produit_id = v_pid and boutique_id = p_source;
    -- Strict, quel que soit le réglage « stock négatif » : on ne déplace pas ce qu'on n'a pas.
    if v_dispo < v_base then
      raise exception 'Stock insuffisant pour « % » dans la boutique d''origine (disponible : % %).', v_prod.nom, trim(trailing '.' from trim(trailing '0' from v_dispo::text)), v_prod.unite_base;
    end if;
    v_resume := v_resume || jsonb_build_array(jsonb_build_object(
      'produit_id', v_pid, 'nom', v_prod.nom, 'quantite', v_qte, 'unite', v_unite_nom,
      'quantite_base', v_base, 'unite_base', v_prod.unite_base));
  end loop;

  insert into transferts_stock (organisation_id, boutique_source, boutique_destination, cle_idempotence, note, lignes, auteur_id)
  values (m.organisation_id, p_source, p_destination, p_cle, nullif(trim(coalesce(p_note, '')), ''), v_resume, auth.uid())
  on conflict (organisation_id, cle_idempotence) do nothing
  returning id into v_id;
  if v_id is null then -- une requête identique vient d'aboutir en parallèle
    select id into v_id from transferts_stock where organisation_id = m.organisation_id and cle_idempotence = p_cle;
    return jsonb_build_object('id', v_id, 'deja_enregistre', true);
  end if;

  for r in select value from jsonb_array_elements(v_resume) loop
    insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite, reference, motif, auteur_id)
    values (m.organisation_id, p_source, (r ->> 'produit_id')::uuid, 'transfert_sortie', -(r ->> 'quantite_base')::numeric, v_id::text, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
    insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite, reference, motif, auteur_id)
    values (m.organisation_id, p_destination, (r ->> 'produit_id')::uuid, 'transfert_entree', (r ->> 'quantite_base')::numeric, v_id::text, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  end loop;

  select nom into v_de from boutiques where id = p_source;
  select nom into v_vers from boutiques where id = p_destination;
  select string_agg(e ->> 'nom', ', ') into v_apercu from (select value as e from jsonb_array_elements(v_resume) limit 5) t;
  perform ecrire_journal(m.organisation_id, p_source, 'stock_transfere', 'transfert', v_id::text,
    jsonb_build_object('de', v_de, 'vers', v_vers, 'nb_produits', jsonb_array_length(v_resume), 'apercu', v_apercu));
  return jsonb_build_object('id', v_id, 'nb_produits', jsonb_array_length(v_resume));
end $$;

revoke execute on function transferer_stock(uuid, uuid, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function transferer_stock(uuid, uuid, jsonb, uuid, text) to authenticated;
