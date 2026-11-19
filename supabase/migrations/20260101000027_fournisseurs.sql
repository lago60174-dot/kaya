-- 22 : fournisseurs, commandes, réceptions, dettes fournisseurs, historique des prix d'achat (section 9.11, plans Pro et Business).
--
-- Une commande n'écrit rien dans le stock. La RÉCEPTION le fait : entrée de stock, prix d'achat du produit mis à jour
-- (avec son historique) et dette envers le fournisseur, dans une seule transaction. Une commande se reçoit en plusieurs fois.

-- 1. La numérotation des documents accepte les commandes (CF-2026-000001).
alter table compteurs_documents drop constraint compteurs_documents_type_check;
alter table compteurs_documents add constraint compteurs_documents_type_check
  check (type in ('devis', 'proforma', 'bon_livraison', 'commande'));
create or replace function prochain_numero_document(p_org uuid, p_boutique uuid, p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_annee int := extract(year from (now() at time zone 'Africa/Douala'))::int;
  v_n int;
  v_prefixe text := case p_type when 'devis' then 'D' when 'proforma' then 'PF' when 'bon_livraison' then 'BL' when 'commande' then 'CF' end;
begin
  if v_prefixe is null then raise exception 'Type de document invalide.'; end if;
  insert into compteurs_documents (boutique_id, annee, type, organisation_id, dernier)
  values (p_boutique, v_annee, p_type, p_org, 1)
  on conflict (boutique_id, annee, type) do update set dernier = compteurs_documents.dernier + 1
  returning dernier into v_n;
  return format('%s-%s-%s', v_prefixe, v_annee, lpad(v_n::text, 6, '0'));
end $$;

-- 2. Tables.
create table fournisseurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  nom text not null check (char_length(trim(nom)) between 2 and 80),
  telephone text check (char_length(telephone) <= 30),
  adresse text check (char_length(adresse) <= 200),
  notes text check (char_length(notes) <= 300),
  archive_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create unique index on fournisseurs (organisation_id, normaliser_texte(nom)) where archive_le is null;

create table commandes_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  fournisseur_id uuid not null references fournisseurs(id),
  numero text not null,
  statut text not null default 'commandee' check (statut in ('commandee', 'recue_partiellement', 'recue', 'annulee')),
  total bigint not null check (total >= 0),
  note text check (char_length(note) <= 300),
  motif_annulation text,
  cle_idempotence uuid not null,
  auteur_id uuid not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (boutique_id, numero),
  unique (boutique_id, cle_idempotence)
);

-- Le prix est par unité de commande (ex. 4 750 FCFA le sac de 50 kg), figé à la commande.
create table commande_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  commande_id uuid not null references commandes_fournisseurs(id),
  produit_id uuid not null references produits(id),
  unite_id uuid not null references produit_unites(id),
  nom_produit text not null,
  nom_unite text not null,
  facteur numeric(12,3) not null check (facteur > 0),
  quantite numeric(12,3) not null check (quantite > 0),
  prix_achat bigint not null check (prix_achat >= 0),
  quantite_recue numeric(12,3) not null default 0 check (quantite_recue >= 0),
  ordre int not null default 0,
  cree_le timestamptz not null default now(),
  check (quantite_recue <= quantite)
);

create table receptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  commande_id uuid not null references commandes_fournisseurs(id),
  montant bigint not null check (montant >= 0),
  cle_idempotence uuid not null,
  auteur_id uuid not null,
  date timestamptz not null default now(),
  unique (boutique_id, cle_idempotence)
);

create table reception_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  reception_id uuid not null references receptions(id),
  commande_ligne_id uuid not null references commande_lignes(id),
  produit_id uuid not null references produits(id),
  quantite numeric(12,3) not null check (quantite > 0),
  montant bigint not null check (montant >= 0)
);

create table dettes_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  fournisseur_id uuid not null references fournisseurs(id),
  commande_id uuid not null references commandes_fournisseurs(id),
  reception_id uuid not null unique references receptions(id),
  montant bigint not null check (montant > 0),
  paye bigint not null default 0 check (paye >= 0),
  solde bigint generated always as (montant - paye) stored,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'soldee')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (paye <= montant)
);

create table paiements_fournisseurs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  dette_id uuid not null references dettes_fournisseurs(id),
  fournisseur_id uuid not null references fournisseurs(id),
  mode text not null check (mode in ('especes', 'mtn_momo', 'orange_money')),
  montant bigint not null check (montant > 0),
  cle_idempotence uuid not null,
  auteur_id uuid not null,
  date timestamptz not null default now(),
  unique (boutique_id, cle_idempotence, dette_id)
);

-- Chaque prix d'achat qui change (par unité de base), pour repérer les hausses.
create table prix_achat_historique (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  produit_id uuid not null references produits(id),
  fournisseur_id uuid references fournisseurs(id),
  reception_id uuid references receptions(id),
  prix_achat bigint not null check (prix_achat >= 0),
  ancien_prix bigint,
  date timestamptz not null default now()
);

create index on commandes_fournisseurs (boutique_id, cree_le desc, id desc);
create index on commandes_fournisseurs (fournisseur_id);
create index on commande_lignes (commande_id);
create index on reception_lignes (reception_id);
create index on dettes_fournisseurs (fournisseur_id) where statut = 'ouverte';
create index on paiements_fournisseurs (dette_id);
create index on prix_achat_historique (produit_id, date desc);

-- 3. Règles d'immuabilité.
create trigger trg_modifie_le before update on fournisseurs for each row execute function maj_modifie_le();
create trigger trg_modifie_le before update on commandes_fournisseurs for each row execute function maj_modifie_le();
create trigger trg_modifie_le before update on dettes_fournisseurs for each row execute function maj_modifie_le();
create trigger trg_pas_de_suppression before delete on fournisseurs for each row execute function interdire_suppression();
create trigger trg_pas_de_suppression before delete on commandes_fournisseurs for each row execute function interdire_suppression();
create trigger trg_pas_de_suppression before delete on commande_lignes for each row execute function interdire_suppression();
create trigger trg_pas_de_suppression before delete on dettes_fournisseurs for each row execute function interdire_suppression();
create trigger trg_immuable before update or delete on receptions for each row execute function interdire_modification();
create trigger trg_immuable before update or delete on reception_lignes for each row execute function interdire_modification();
create trigger trg_immuable before update or delete on paiements_fournisseurs for each row execute function interdire_modification();
create trigger trg_immuable before update or delete on prix_achat_historique for each row execute function interdire_modification();

-- Une ligne de commande ne change que par sa quantité reçue, qui ne fait qu'augmenter.
create function verifier_commande_ligne() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'quantite_recue') is distinct from (to_jsonb(old) - 'quantite_recue') then
    raise exception 'Une ligne de commande ne se modifie pas : annulez la commande et refaites-la.';
  end if;
  if new.quantite_recue < old.quantite_recue then
    raise exception 'Une quantité reçue ne diminue jamais.';
  end if;
  return new;
end $$;
create trigger trg_commande_ligne before update on commande_lignes for each row execute function verifier_commande_ligne();

-- Une commande ne change que de statut (jamais de contenu) : commandee -> recue_partiellement -> recue, ou -> annulee.
create function verifier_commande() returns trigger language plpgsql as $$
declare v_libres text[] := array['statut', 'motif_annulation', 'modifie_le'];
begin
  if (to_jsonb(new) - v_libres) is distinct from (to_jsonb(old) - v_libres) then
    raise exception 'Une commande ne se modifie pas : annulez-la et refaites-en une.';
  end if;
  if old.statut in ('recue', 'annulee') and new.statut is distinct from old.statut then
    raise exception 'Cette commande est terminée (%).', old.statut;
  end if;
  return new;
end $$;
create trigger trg_commande before update on commandes_fournisseurs for each row execute function verifier_commande();

-- 4. Droits et lecture : propriétaire seulement, comme le menu.
alter table fournisseurs enable row level security;
alter table commandes_fournisseurs enable row level security;
alter table commande_lignes enable row level security;
alter table receptions enable row level security;
alter table reception_lignes enable row level security;
alter table dettes_fournisseurs enable row level security;
alter table paiements_fournisseurs enable row level security;
alter table prix_achat_historique enable row level security;
revoke all on fournisseurs, commandes_fournisseurs, commande_lignes, receptions, reception_lignes,
  dettes_fournisseurs, paiements_fournisseurs, prix_achat_historique from anon, authenticated;
grant select on fournisseurs, commandes_fournisseurs, commande_lignes, receptions, reception_lignes,
  dettes_fournisseurs, paiements_fournisseurs, prix_achat_historique to authenticated;

create policy lecture on fournisseurs for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire');
create policy lecture on prix_achat_historique for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire');
do $$
declare t text;
begin
  foreach t in array array['commandes_fournisseurs', 'receptions', 'dettes_fournisseurs', 'paiements_fournisseurs'] loop
    execute format('create policy lecture on %I for select to authenticated using (organisation_id = app_org_id() and app_role() = ''proprietaire'' and app_acces_boutique(boutique_id))', t);
  end loop;
end $$;
create policy lecture on commande_lignes for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire'
         and exists (select 1 from commandes_fournisseurs c where c.id = commande_id and app_acces_boutique(c.boutique_id)));
create policy lecture on reception_lignes for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire'
         and exists (select 1 from receptions r where r.id = reception_id and app_acces_boutique(r.boutique_id)));

-- 5. Fonctions.
create function exiger_acces_fournisseurs(p_boutique uuid) returns membres language plpgsql security definer set search_path = public as $$
declare m membres;
begin
  m := exiger_acces(p_boutique);
  perform verifier_ecriture(m.organisation_id);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut gérer les fournisseurs.'; end if;
  if not plan_permet(m.organisation_id, 'fournisseurs') then
    raise exception 'Les fournisseurs ne sont pas inclus dans votre abonnement.';
  end if;
  return m;
end $$;

-- Crée (p_id null) ou modifie une fiche fournisseur.
create function enregistrer_fournisseur(p_boutique uuid, p_id uuid, p_nom text, p_telephone text, p_adresse text, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m membres; v_id uuid;
  v_nom text := trim(coalesce(p_nom, ''));
  v_tel text := nullif(trim(coalesce(p_telephone, '')), '');
  v_adr text := nullif(trim(coalesce(p_adresse, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  m := exiger_acces_fournisseurs(p_boutique);
  if char_length(v_nom) < 2 or char_length(v_nom) > 80 then raise exception 'Entrez le nom du fournisseur (2 à 80 caractères).'; end if;
  if char_length(v_tel) > 30 then raise exception 'Le téléphone est trop long.'; end if;
  if char_length(v_adr) > 200 then raise exception 'L''adresse est trop longue (200 caractères maximum).'; end if;
  if char_length(v_notes) > 300 then raise exception 'Les notes sont trop longues (300 caractères maximum).'; end if;
  if exists (select 1 from fournisseurs where organisation_id = m.organisation_id and archive_le is null
             and normaliser_texte(nom) = normaliser_texte(v_nom) and id is distinct from p_id) then
    raise exception 'Un fournisseur porte déjà ce nom.';
  end if;
  if p_id is null then
    insert into fournisseurs (organisation_id, nom, telephone, adresse, notes)
    values (m.organisation_id, v_nom, v_tel, v_adr, v_notes) returning id into v_id;
  else
    update fournisseurs set nom = v_nom, telephone = v_tel, adresse = v_adr, notes = v_notes
     where id = p_id and organisation_id = m.organisation_id and archive_le is null returning id into v_id;
    if v_id is null then raise exception 'Fournisseur introuvable.'; end if;
  end if;
  return v_id;
end $$;

-- Un fournisseur à qui l'on doit encore de l'argent ne s'archive pas.
create function archiver_fournisseur(p_boutique uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m membres; v_dette bigint;
begin
  m := exiger_acces_fournisseurs(p_boutique);
  if not exists (select 1 from fournisseurs where id = p_id and organisation_id = m.organisation_id and archive_le is null) then
    raise exception 'Fournisseur introuvable.';
  end if;
  select coalesce(sum(solde), 0) into v_dette from dettes_fournisseurs where fournisseur_id = p_id and statut = 'ouverte';
  if v_dette > 0 then raise exception 'Vous devez encore % FCFA à ce fournisseur : impossible de l''archiver.', v_dette; end if;
  if exists (select 1 from commandes_fournisseurs where fournisseur_id = p_id and statut in ('commandee', 'recue_partiellement')) then
    raise exception 'Ce fournisseur a une commande en cours : impossible de l''archiver.';
  end if;
  update fournisseurs set archive_le = now() where id = p_id;
end $$;

-- Commande. Lignes : [{produit_id, unite_id, quantite, prix_achat}] (prix par unité de commande).
create function creer_commande(p_boutique uuid, p_cle uuid, p_fournisseur uuid, p_lignes jsonb, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres; c commandes_fournisseurs; v_nb int; v_total bigint;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_numero text;
begin
  m := exiger_acces_fournisseurs(p_boutique);
  select * into c from commandes_fournisseurs where boutique_id = p_boutique and cle_idempotence = p_cle;
  if found then
    return jsonb_build_object('commande_id', c.id, 'numero', c.numero, 'total', c.total, 'deja_enregistree', true);
  end if;
  if not exists (select 1 from fournisseurs where id = p_fournisseur and organisation_id = m.organisation_id and archive_le is null) then
    raise exception 'Fournisseur introuvable.';
  end if;
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then raise exception 'Ajoutez au moins un article.'; end if;
  if jsonb_array_length(p_lignes) > 100 then raise exception 'Trop d''articles dans une même commande.'; end if;
  if char_length(v_note) > 300 then raise exception 'La note est trop longue (300 caractères maximum).'; end if;
  if exists (select 1 from jsonb_to_recordset(p_lignes) as l(quantite numeric, prix_achat bigint)
             where l.quantite is null or l.quantite <= 0 or l.quantite <> round(l.quantite, 3)
                or l.prix_achat is null or l.prix_achat < 0) then
    raise exception 'Quantité ou prix d''achat invalide.';
  end if;
  select count(*), coalesce(sum(round(l.quantite * l.prix_achat)), 0) into v_nb, v_total
  from jsonb_to_recordset(p_lignes) as l(produit_id uuid, unite_id uuid, quantite numeric, prix_achat bigint)
  join produit_unites u on u.id = l.unite_id and u.produit_id = l.produit_id and u.organisation_id = m.organisation_id and u.archive_le is null
  join produits p on p.id = l.produit_id and p.organisation_id = m.organisation_id and p.archive_le is null;
  if v_nb <> jsonb_array_length(p_lignes) then raise exception 'Un article ou une unité est introuvable.'; end if;
  if v_total <= 0 then raise exception 'Le total de la commande doit être supérieur à zéro.'; end if;

  v_numero := prochain_numero_document(m.organisation_id, p_boutique, 'commande');
  insert into commandes_fournisseurs (organisation_id, boutique_id, fournisseur_id, numero, total, note, cle_idempotence, auteur_id)
  values (m.organisation_id, p_boutique, p_fournisseur, v_numero, v_total, v_note, p_cle, auth.uid()) returning * into c;
  insert into commande_lignes (organisation_id, commande_id, produit_id, unite_id, nom_produit, nom_unite, facteur, quantite, prix_achat, ordre)
  select m.organisation_id, c.id, l.produit_id, l.unite_id, p.nom_affiche, u.nom, u.facteur, l.quantite, l.prix_achat, t.i::int
  from jsonb_array_elements(p_lignes) with ordinality t(e, i)
  cross join lateral jsonb_to_record(t.e) as l(produit_id uuid, unite_id uuid, quantite numeric, prix_achat bigint)
  join produit_unites u on u.id = l.unite_id
  join produits p on p.id = l.produit_id;
  perform ecrire_journal(m.organisation_id, p_boutique, 'commande_creee', 'commande', c.id::text,
    jsonb_build_object('numero', v_numero, 'total', v_total, 'fournisseur', (select nom from fournisseurs where id = p_fournisseur)));
  return jsonb_build_object('commande_id', c.id, 'numero', v_numero, 'total', v_total, 'deja_enregistree', false);
end $$;

-- Réception (totale ou partielle). Lignes : [{commande_ligne_id, quantite}] (dans l'unité de commande).
-- Alimente le stock, met à jour le prix d'achat (par unité de base) et son historique, crée la dette,
-- puis enregistre un éventuel paiement comptant (p_paye), le tout dans la même transaction.
create function receptionner_commande(p_commande uuid, p_cle uuid, p_lignes jsonb, p_paye bigint default 0, p_mode text default 'especes')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c commandes_fournisseurs; m membres; r receptions; l record; d dettes_fournisseurs;
  v_montant bigint; v_prix_base bigint; v_ancien bigint; v_restant int; v_nb_prix int := 0;
  v_paye bigint := coalesce(p_paye, 0);
begin
  select * into c from commandes_fournisseurs where id = p_commande for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  m := exiger_acces_fournisseurs(c.boutique_id);

  select * into r from receptions where boutique_id = c.boutique_id and cle_idempotence = p_cle;
  if found then
    return jsonb_build_object('reception_id', r.id, 'montant', r.montant, 'deja_enregistree', true);
  end if;
  if c.statut = 'recue' then raise exception 'Cette commande est déjà reçue en entier.'; end if;
  if c.statut = 'annulee' then raise exception 'Cette commande est annulée.'; end if;
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then raise exception 'Indiquez les quantités reçues.'; end if;
  if v_paye < 0 then raise exception 'Montant payé invalide.'; end if;
  if v_paye > 0 and p_mode not in ('especes', 'mtn_momo', 'orange_money') then raise exception 'Mode de paiement invalide.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_lignes) as x(quantite numeric) where x.quantite is null or x.quantite <= 0 or x.quantite <> round(x.quantite, 3)) then
    raise exception 'Quantité reçue invalide.';
  end if;
  if (select count(*) from jsonb_to_recordset(p_lignes) as x(commande_ligne_id uuid)) <>
     (select count(distinct x.commande_ligne_id) from jsonb_to_recordset(p_lignes) as x(commande_ligne_id uuid)) then
    raise exception 'Une ligne apparaît deux fois.';
  end if;

  -- Contrôle de toutes les lignes avant d'écrire quoi que ce soit, et valeur de la réception.
  for l in
    select x.commande_ligne_id, x.quantite as recue, cl.id as trouvee, cl.nom_produit, cl.quantite, cl.quantite_recue, cl.prix_achat
    from jsonb_to_recordset(p_lignes) as x(commande_ligne_id uuid, quantite numeric)
    left join commande_lignes cl on cl.id = x.commande_ligne_id and cl.commande_id = c.id
  loop
    if l.trouvee is null then raise exception 'Une ligne ne fait pas partie de cette commande.'; end if;
    if l.quantite_recue + l.recue > l.quantite then
      raise exception 'Trop reçu pour « % » : % commandé(s), % déjà reçu(s).', l.nom_produit, l.quantite, l.quantite_recue;
    end if;
  end loop;
  select coalesce(sum(round(x.quantite * cl.prix_achat)), 0) into v_montant
  from jsonb_to_recordset(p_lignes) as x(commande_ligne_id uuid, quantite numeric)
  join commande_lignes cl on cl.id = x.commande_ligne_id;
  if v_montant <= 0 then raise exception 'La valeur reçue doit être supérieure à zéro.'; end if;
  if v_paye > v_montant then raise exception 'Le montant payé dépasse la valeur reçue (% FCFA).', v_montant; end if;

  insert into receptions (organisation_id, boutique_id, commande_id, montant, cle_idempotence, auteur_id)
  values (c.organisation_id, c.boutique_id, c.id, v_montant, p_cle, auth.uid()) returning * into r;

  for l in
    select x.quantite as recue, cl.*
    from jsonb_to_recordset(p_lignes) as x(commande_ligne_id uuid, quantite numeric)
    join commande_lignes cl on cl.id = x.commande_ligne_id
    order by cl.produit_id, cl.ordre
  loop
    update commande_lignes set quantite_recue = quantite_recue + l.recue where id = l.id;
    insert into reception_lignes (organisation_id, reception_id, commande_ligne_id, produit_id, quantite, montant)
    values (c.organisation_id, r.id, l.id, l.produit_id, l.recue, round(l.recue * l.prix_achat));
    insert into stock_courant (produit_id, boutique_id, organisation_id, quantite)
    values (l.produit_id, c.boutique_id, c.organisation_id, 0) on conflict do nothing;
    insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite, reference, motif, auteur_id)
    values (c.organisation_id, c.boutique_id, l.produit_id, 'entree', l.recue * l.facteur, r.id::text, 'Réception ' || c.numero, auth.uid());

    v_prix_base := round(l.prix_achat / l.facteur);
    select prix_achat into v_ancien from produit_couts where produit_id = l.produit_id;
    if v_ancien is distinct from v_prix_base then
      insert into produit_couts (produit_id, organisation_id, prix_achat) values (l.produit_id, c.organisation_id, v_prix_base)
      on conflict (produit_id) do update set prix_achat = excluded.prix_achat, modifie_le = now();
      insert into prix_achat_historique (organisation_id, produit_id, fournisseur_id, reception_id, prix_achat, ancien_prix)
      values (c.organisation_id, l.produit_id, c.fournisseur_id, r.id, v_prix_base, v_ancien);
      v_nb_prix := v_nb_prix + 1;
    end if;
  end loop;

  select count(*) into v_restant from commande_lignes where commande_id = c.id and quantite_recue < quantite;
  update commandes_fournisseurs set statut = case when v_restant = 0 then 'recue' else 'recue_partiellement' end where id = c.id;

  insert into dettes_fournisseurs (organisation_id, boutique_id, fournisseur_id, commande_id, reception_id, montant, paye, statut)
  values (c.organisation_id, c.boutique_id, c.fournisseur_id, c.id, r.id, v_montant, v_paye, case when v_paye = v_montant then 'soldee' else 'ouverte' end)
  returning * into d;
  if v_paye > 0 then
    insert into paiements_fournisseurs (organisation_id, boutique_id, dette_id, fournisseur_id, mode, montant, cle_idempotence, auteur_id)
    values (c.organisation_id, c.boutique_id, d.id, c.fournisseur_id, p_mode, v_paye, p_cle, auth.uid());
  end if;

  perform ecrire_journal(c.organisation_id, c.boutique_id, 'commande_recue', 'commande', c.id::text,
    jsonb_build_object('numero', c.numero, 'montant', v_montant, 'paye', v_paye, 'prix_modifies', v_nb_prix));
  return jsonb_build_object('reception_id', r.id, 'dette_id', d.id, 'montant', v_montant, 'paye', v_paye,
    'prix_modifies', v_nb_prix, 'statut', case when v_restant = 0 then 'recue' else 'recue_partiellement' end, 'deja_enregistree', false);
end $$;

-- Annulation : seulement si rien n'a été reçu (sinon la dette et le stock existent déjà). Motif obligatoire.
create function annuler_commande(p_commande uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
declare c commandes_fournisseurs; m membres; v_motif text := trim(coalesce(p_motif, ''));
begin
  select * into c from commandes_fournisseurs where id = p_commande for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  m := exiger_acces_fournisseurs(c.boutique_id);
  if char_length(v_motif) < 3 then raise exception 'Indiquez le motif de l''annulation.'; end if;
  if c.statut = 'annulee' then return; end if;
  if c.statut <> 'commandee' then raise exception 'Une partie de cette commande est déjà reçue : elle ne peut plus être annulée.'; end if;
  update commandes_fournisseurs set statut = 'annulee', motif_annulation = v_motif where id = c.id;
  perform ecrire_journal(m.organisation_id, c.boutique_id, 'commande_annulee', 'commande', c.id::text,
    jsonb_build_object('numero', c.numero, 'motif', v_motif));
end $$;

-- Paiement (partiel ou total) d'une dette. La clé rend l'envoi répétable sans doublon.
create function payer_dette_fournisseur(p_dette uuid, p_cle uuid, p_montant bigint, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d dettes_fournisseurs; m membres; p paiements_fournisseurs;
begin
  select * into d from dettes_fournisseurs where id = p_dette for update;
  if not found then raise exception 'Dette introuvable.'; end if;
  m := exiger_acces_fournisseurs(d.boutique_id);
  select * into p from paiements_fournisseurs where boutique_id = d.boutique_id and cle_idempotence = p_cle and dette_id = d.id;
  if found then return jsonb_build_object('solde', d.solde, 'deja_enregistre', true); end if;
  if p_mode not in ('especes', 'mtn_momo', 'orange_money') then raise exception 'Mode de paiement invalide.'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Entrez un montant supérieur à zéro.'; end if;
  if d.statut = 'soldee' then raise exception 'Cette dette est déjà soldée.'; end if;
  if p_montant > d.solde then raise exception 'Le montant dépasse ce que vous devez (% FCFA).', d.solde; end if;
  insert into paiements_fournisseurs (organisation_id, boutique_id, dette_id, fournisseur_id, mode, montant, cle_idempotence, auteur_id)
  values (d.organisation_id, d.boutique_id, d.id, d.fournisseur_id, p_mode, p_montant, p_cle, auth.uid());
  update dettes_fournisseurs set paye = paye + p_montant, statut = case when paye + p_montant = montant then 'soldee' else 'ouverte' end
   where id = d.id returning * into d;
  perform ecrire_journal(m.organisation_id, d.boutique_id, 'paiement_fournisseur', 'fournisseur', d.fournisseur_id::text,
    jsonb_build_object('montant', p_montant, 'mode', p_mode, 'solde', d.solde,
                       'fournisseur', (select nom from fournisseurs where id = d.fournisseur_id)));
  return jsonb_build_object('solde', d.solde, 'deja_enregistre', false);
end $$;

-- Fournisseurs avec ce qui leur est dû, et commandes paginées (droits de l'appelant : la RLS s'applique).
create function lister_fournisseurs(p_boutique uuid) returns jsonb language plpgsql stable set search_path = public as $$
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.nom) from (
      select f.id, f.nom, f.telephone, coalesce(sum(d.solde) filter (where d.statut = 'ouverte'), 0)::bigint as du
        from fournisseurs f
        left join dettes_fournisseurs d on d.fournisseur_id = f.id and d.boutique_id = p_boutique
       where f.archive_le is null
       group by f.id
    ) x), '[]');
end $$;

create function lister_commandes(
  p_boutique uuid, p_statut text default null, p_limite int default 30, p_apres_date timestamptz default null, p_apres_id uuid default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100); v_lignes jsonb; v_suivant jsonb;
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  if p_statut is not null and p_statut not in ('commandee', 'recue_partiellement', 'recue', 'annulee') then raise exception 'Statut invalide.'; end if;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.cree_le desc, b.id desc), '[]') into v_lignes from (
    select c.id, c.numero, c.statut, c.total, c.cree_le, f.nom as fournisseur_nom
      from commandes_fournisseurs c join fournisseurs f on f.id = c.fournisseur_id
     where c.boutique_id = p_boutique and (p_statut is null or c.statut = p_statut)
       and (p_apres_date is null or (c.cree_le, c.id) < (p_apres_date, p_apres_id))
     order by c.cree_le desc, c.id desc limit v_limite + 1
  ) b;
  if jsonb_array_length(v_lignes) > v_limite then
    v_suivant := jsonb_build_object('date', v_lignes -> (v_limite - 1) ->> 'cree_le', 'id', v_lignes -> (v_limite - 1) ->> 'id');
  end if;
  select coalesce(jsonb_agg(e order by i), '[]') into v_lignes from jsonb_array_elements(v_lignes) with ordinality t(e, i) where i <= v_limite;
  return jsonb_build_object('commandes', v_lignes, 'suivant', v_suivant);
end $$;

revoke execute on function
  verifier_commande_ligne(), verifier_commande(), exiger_acces_fournisseurs(uuid),
  enregistrer_fournisseur(uuid, uuid, text, text, text, text), archiver_fournisseur(uuid, uuid),
  creer_commande(uuid, uuid, uuid, jsonb, text), receptionner_commande(uuid, uuid, jsonb, bigint, text),
  annuler_commande(uuid, text), payer_dette_fournisseur(uuid, uuid, bigint, text),
  lister_fournisseurs(uuid), lister_commandes(uuid, text, int, timestamptz, uuid)
from public, anon, authenticated;
grant execute on function
  enregistrer_fournisseur(uuid, uuid, text, text, text, text), archiver_fournisseur(uuid, uuid),
  creer_commande(uuid, uuid, uuid, jsonb, text), receptionner_commande(uuid, uuid, jsonb, bigint, text),
  annuler_commande(uuid, text), payer_dette_fournisseur(uuid, uuid, bigint, text),
  lister_fournisseurs(uuid), lister_commandes(uuid, text, int, timestamptz, uuid)
to authenticated;
