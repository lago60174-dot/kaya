-- Produits et stock : recherche sans accents, fiche produit atomique, liste paginée.

create function normaliser_texte(t text) returns text language sql immutable as $$
  select lower(translate(t, 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'))
$$;

-- Marques : un même article (ciment, peinture...) existe souvent en plusieurs marques, chacune avec son stock et ses prix.
-- Chaque marque donne donc un produit distinct ; la marque s'affiche et se cherche avec le nom.
create table marques (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  nom text not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create unique index on marques (organisation_id, normaliser_texte(nom));
create trigger trg_modifie_le before update on marques for each row execute function maj_modifie_le();
create trigger trg_pas_de_suppression before delete on marques for each row execute function interdire_suppression();

alter table produits add column marque_id uuid references marques(id);
alter table produits add column nom_affiche text not null default '';
alter table produits add column nom_recherche text not null default '';

create function maj_nom_produit() returns trigger language plpgsql as $$
declare v_marque text;
begin
  select nom into v_marque from marques where id = new.marque_id;
  new.nom_affiche := new.nom || coalesce(' · ' || v_marque, '');
  new.nom_recherche := normaliser_texte(new.nom_affiche);
  return new;
end $$;
create trigger trg_nom_produit before insert or update of nom, marque_id on produits
  for each row execute function maj_nom_produit();

-- Renommer une marque met à jour le nom affiché et la recherche de ses produits.
create function propager_nom_marque() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update produits set marque_id = marque_id where marque_id = new.id;
  return new;
end $$;
create trigger trg_nom_marque after update of nom on marques for each row execute function propager_nom_marque();

create unique index on produits (organisation_id, nom_recherche) where archive_le is null;
create index on produits (organisation_id, nom_recherche, id) where archive_le is null;

-- Fiche produit : produit, prix d'achat et unités de vente en une seule transaction (propriétaire).
-- p_unites : [{id?, nom, facteur, prix_vente}]. Une unité retirée est archivée (les ventes y font référence).
create function enregistrer_produit(
  p_boutique uuid, p_id uuid, p_nom text, p_categorie_id uuid, p_unite_base text, p_seuil_alerte numeric,
  p_prix_achat bigint, p_unites jsonb, p_image_cle text default null, p_vignette_cle text default null,
  p_code_barres text default null, p_actif boolean default true, p_marque_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  m membres; v_id uuid := p_id; v_ancien produits; v_cout_ancien bigint; v_prix_change boolean := false;
  v_nb int; v_noms int; u record; v_existe produit_unites;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut modifier les produits.'; end if;
  perform verifier_ecriture(m.organisation_id);
  if length(trim(coalesce(p_nom, ''))) = 0 then raise exception 'Le nom du produit est obligatoire.'; end if;
  if length(trim(coalesce(p_unite_base, ''))) = 0 then raise exception 'L''unité de base est obligatoire.'; end if;
  if p_seuil_alerte is null or p_seuil_alerte < 0 or p_seuil_alerte <> round(p_seuil_alerte, 3) then
    raise exception 'Le seuil d''alerte est invalide.';
  end if;
  if coalesce(p_prix_achat, 0) < 0 then raise exception 'Le prix d''achat est invalide.'; end if;
  if p_categorie_id is not null and not exists (select 1 from categories where id = p_categorie_id and organisation_id = m.organisation_id) then
    raise exception 'Catégorie introuvable.';
  end if;
  if p_marque_id is not null and not exists (select 1 from marques where id = p_marque_id and organisation_id = m.organisation_id) then
    raise exception 'Marque introuvable.';
  end if;
  if exists (select 1 from produits where organisation_id = m.organisation_id and archive_le is null and id is distinct from p_id
             and nom_recherche = normaliser_texte(trim(p_nom) || coalesce(' · ' || (select nom from marques where id = p_marque_id), ''))) then
    raise exception 'Ce produit existe déjà avec cette marque.';
  end if;
  if (p_image_cle is not null and p_image_cle not like m.organisation_id::text || '/%')
     or (p_vignette_cle is not null and p_vignette_cle not like m.organisation_id::text || '/%') then
    raise exception 'Image invalide.';
  end if;
  if jsonb_typeof(p_unites) is distinct from 'array' or jsonb_array_length(p_unites) = 0 then
    raise exception 'Ajoutez au moins une unité de vente.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_unites) as x(nom text, facteur numeric, prix_vente bigint)
             where length(trim(coalesce(x.nom, ''))) = 0 or x.facteur is null or x.facteur <= 0
                or x.facteur <> round(x.facteur, 3) or x.prix_vente is null or x.prix_vente < 0) then
    raise exception 'Une unité de vente est invalide (nom, facteur ou prix).';
  end if;
  select count(*), count(distinct lower(trim(x.nom))) into v_nb, v_noms from jsonb_to_recordset(p_unites) as x(nom text);
  if v_nb <> v_noms then raise exception 'Deux unités portent le même nom.'; end if;

  if v_id is null then
    insert into produits (organisation_id, categorie_id, marque_id, nom, image_cle, vignette_cle, unite_base, seuil_alerte, actif, code_barres)
    values (m.organisation_id, p_categorie_id, p_marque_id, trim(p_nom), p_image_cle, p_vignette_cle, trim(p_unite_base), p_seuil_alerte,
            coalesce(p_actif, true), nullif(trim(p_code_barres), ''))
    returning id into v_id;
    insert into produit_couts (produit_id, organisation_id, prix_achat) values (v_id, m.organisation_id, coalesce(p_prix_achat, 0));
  else
    select * into v_ancien from produits where id = v_id and organisation_id = m.organisation_id for update;
    if not found then raise exception 'Produit introuvable.'; end if;
    if v_ancien.unite_base <> trim(p_unite_base) and exists (select 1 from mouvements_stock where produit_id = v_id) then
      raise exception 'Impossible de changer l''unité de base : ce produit a déjà des mouvements de stock.';
    end if;
    update produits set categorie_id = p_categorie_id, marque_id = p_marque_id, nom = trim(p_nom), image_cle = p_image_cle, vignette_cle = p_vignette_cle,
      unite_base = trim(p_unite_base), seuil_alerte = p_seuil_alerte, actif = coalesce(p_actif, true),
      code_barres = nullif(trim(p_code_barres), '')
    where id = v_id;
    select prix_achat into v_cout_ancien from produit_couts where produit_id = v_id;
    insert into produit_couts (produit_id, organisation_id, prix_achat) values (v_id, m.organisation_id, coalesce(p_prix_achat, 0))
    on conflict (produit_id) do update set prix_achat = excluded.prix_achat;
    if v_cout_ancien is distinct from coalesce(p_prix_achat, 0) then v_prix_change := true; end if;
  end if;

  update produit_unites set archive_le = now()
   where produit_id = v_id and archive_le is null
     and id not in (select x.id from jsonb_to_recordset(p_unites) as x(id uuid) where x.id is not null);
  for u in select * from jsonb_to_recordset(p_unites) as x(id uuid, nom text, facteur numeric, prix_vente bigint) loop
    if u.id is not null then
      select * into v_existe from produit_unites where id = u.id and produit_id = v_id;
      if not found then raise exception 'Unité introuvable.'; end if;
      if v_existe.prix_vente <> u.prix_vente then v_prix_change := true; end if;
      update produit_unites set nom = trim(u.nom), facteur = u.facteur, prix_vente = u.prix_vente, archive_le = null where id = u.id;
    else
      insert into produit_unites (organisation_id, produit_id, nom, facteur, prix_vente)
      values (m.organisation_id, v_id, trim(u.nom), u.facteur, u.prix_vente)
      on conflict (produit_id, nom) do update set facteur = excluded.facteur, prix_vente = excluded.prix_vente, archive_le = null;
    end if;
  end loop;

  perform ecrire_journal(m.organisation_id, p_boutique, case when p_id is null then 'produit_cree' else 'produit_modifie' end,
    'produit', v_id::text, jsonb_build_object('nom', trim(p_nom)));
  if v_prix_change and p_id is not null then
    perform ecrire_journal(m.organisation_id, p_boutique, 'prix_modifie', 'produit', v_id::text, jsonb_build_object('nom', trim(p_nom)));
  end if;
  return v_id;
end $$;

create function archiver_produit(p_boutique uuid, p_id uuid, p_archiver boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m membres;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut archiver un produit.'; end if;
  perform verifier_ecriture(m.organisation_id);
  update produits set archive_le = case when p_archiver then now() else null end, actif = not p_archiver
   where id = p_id and organisation_id = m.organisation_id;
  if not found then raise exception 'Produit introuvable.'; end if;
  perform ecrire_journal(m.organisation_id, p_boutique, case when p_archiver then 'produit_archive' else 'produit_restaure' end,
    'produit', p_id::text, '{}');
end $$;

-- Liste paginée (curseur nom + id), avec stock de la boutique. Ne contient jamais le prix d'achat.
-- Exécutée avec les droits de l'appelant : la RLS s'applique.
create function lister_produits(
  p_boutique uuid, p_recherche text default null, p_categorie uuid default null, p_stock_bas boolean default false,
  p_limite int default 30, p_apres_nom text default null, p_apres_id uuid default null, p_marque uuid default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_terme text := nullif(trim(normaliser_texte(p_recherche)), '');
  v_lignes jsonb; v_suivant jsonb;
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  if v_terme is not null then
    v_terme := replace(replace(replace(v_terme, '\', '\'), '%', '\%'), '_', '\_');
  end if;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.nom_recherche, b.id), '[]') into v_lignes from (
    select p.id, p.nom, p.nom_affiche, p.nom_recherche, p.categorie_id, c.nom as categorie_nom, p.marque_id, mq.nom as marque_nom, p.unite_base, p.seuil_alerte, p.actif, p.vignette_cle,
           coalesce(s.quantite, 0) as stock, coalesce(s.quantite, 0) < p.seuil_alerte as stock_bas,
           (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nom', u.nom, 'facteur', u.facteur, 'prix_vente', u.prix_vente)
                                       order by u.facteur desc, u.nom), '[]')
              from produit_unites u where u.produit_id = p.id and u.archive_le is null) as unites
      from produits p
      left join categories c on c.id = p.categorie_id
      left join marques mq on mq.id = p.marque_id
      left join stock_courant s on s.produit_id = p.id and s.boutique_id = p_boutique
     where p.archive_le is null
       and (v_terme is null or p.nom_recherche like '%' || v_terme || '%' escape '\')
       and (p_categorie is null or p.categorie_id = p_categorie)
       and (p_marque is null or p.marque_id = p_marque)
       and (not coalesce(p_stock_bas, false) or coalesce(s.quantite, 0) < p.seuil_alerte)
       and (p_apres_nom is null or (p.nom_recherche, p.id) > (p_apres_nom, p_apres_id))
     order by p.nom_recherche, p.id
     limit v_limite + 1
  ) b;
  if jsonb_array_length(v_lignes) > v_limite then
    v_suivant := jsonb_build_object('nom', v_lignes -> (v_limite - 1) ->> 'nom_recherche', 'id', v_lignes -> (v_limite - 1) ->> 'id');
  end if;
  select coalesce(jsonb_agg(e - 'nom_recherche' order by i), '[]') into v_lignes
    from jsonb_array_elements(v_lignes) with ordinality t(e, i) where i <= v_limite;
  return jsonb_build_object('produits', v_lignes, 'suivant', v_suivant);
end $$;

revoke execute on function normaliser_texte(text), enregistrer_produit(uuid, uuid, text, uuid, text, numeric, bigint, jsonb, text, text, text, boolean, uuid),
  archiver_produit(uuid, uuid, boolean), lister_produits(uuid, text, uuid, boolean, int, text, uuid, uuid) from public, anon, authenticated;
grant execute on function normaliser_texte(text), enregistrer_produit(uuid, uuid, text, uuid, text, numeric, bigint, jsonb, text, text, text, boolean, uuid),
  archiver_produit(uuid, uuid, boolean), lister_produits(uuid, text, uuid, boolean, int, text, uuid, uuid) to authenticated;

-- RLS des marques (comme les catégories : lecture pour l'organisation, écriture pour le propriétaire).
alter table marques enable row level security;
revoke all on marques from anon, authenticated;
grant select, insert, update on marques to authenticated;
create policy lecture on marques for select to authenticated using (organisation_id = app_org_id());
create policy ecriture_ajout on marques for insert to authenticated
  with check (organisation_id = app_org_id() and app_role() = 'proprietaire');
create policy ecriture_modif on marques for update to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire')
  with check (organisation_id = app_org_id() and app_role() = 'proprietaire');
create policy lecture_seule_ajout on marques as restrictive for insert to authenticated with check (app_ecriture_ok());
create policy lecture_seule_modif on marques as restrictive for update to authenticated using (app_ecriture_ok()) with check (app_ecriture_ok());
