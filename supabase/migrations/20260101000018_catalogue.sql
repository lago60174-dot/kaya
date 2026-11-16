-- Catalogue modèle : photos partagées (fichiers statiques) et import en une transaction.

create or replace function enregistrer_produit(
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
  -- Une photo est à la boutique (organisation/empreinte) ou vient du catalogue modèle (fichier statique partagé).
  if (p_image_cle is not null and p_image_cle not like m.organisation_id::text || '/%' and p_image_cle !~ '^catalogue/[a-z0-9-]+\.webp$')
     or (p_vignette_cle is not null and p_vignette_cle not like m.organisation_id::text || '/%' and p_vignette_cle !~ '^catalogue/[a-z0-9-]+-v\.webp$') then
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

-- Import du catalogue modèle : crée d'un coup les produits cochés par le propriétaire (catégories et marques comprises).
-- p_produits : [{ref, nom, categorie, marque, unite_base, prix_achat, seuil_alerte, actif, image_cle, vignette_cle, unites: [{nom, facteur, prix_vente}]}]
-- Un produit déjà présent (même nom et même marque) est ignoré : relancer l'import ne crée jamais de doublon.
-- Tout ou rien : la moindre erreur annule l'import entier.
create function importer_catalogue(p_boutique uuid, p_produits jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres; x record; v_cat uuid; v_marque uuid; v_crees int := 0; v_ignores int := 0; v_nom text;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut importer le catalogue.'; end if;
  perform verifier_ecriture(m.organisation_id);
  if jsonb_typeof(p_produits) is distinct from 'array' or jsonb_array_length(p_produits) = 0 then
    raise exception 'Aucun produit à importer.';
  end if;
  if jsonb_array_length(p_produits) > 500 then raise exception 'Trop de produits d''un coup (500 au maximum).'; end if;

  for x in select * from jsonb_to_recordset(p_produits) as t(
    ref text, nom text, categorie text, marque text, unite_base text, prix_achat bigint, seuil_alerte numeric,
    actif boolean, image_cle text, vignette_cle text, unites jsonb
  ) loop
    v_nom := trim(coalesce(x.nom, '')) || coalesce(' · ' || nullif(trim(x.marque), ''), '');
    if exists (select 1 from produits where organisation_id = m.organisation_id and archive_le is null
               and nom_recherche = normaliser_texte(v_nom)) then
      v_ignores := v_ignores + 1;
      continue;
    end if;

    v_cat := null;
    if nullif(trim(x.categorie), '') is not null then
      select id into v_cat from categories
       where organisation_id = m.organisation_id and normaliser_texte(nom) = normaliser_texte(trim(x.categorie));
      if v_cat is null then
        insert into categories (organisation_id, nom) values (m.organisation_id, trim(x.categorie)) returning id into v_cat;
      end if;
    end if;

    v_marque := null;
    if nullif(trim(x.marque), '') is not null then
      select id into v_marque from marques
       where organisation_id = m.organisation_id and normaliser_texte(nom) = normaliser_texte(trim(x.marque));
      if v_marque is null then
        insert into marques (organisation_id, nom) values (m.organisation_id, trim(x.marque)) returning id into v_marque;
      end if;
    end if;

    perform enregistrer_produit(p_boutique, null, x.nom, v_cat, x.unite_base, coalesce(x.seuil_alerte, 0),
      coalesce(x.prix_achat, 0), x.unites, x.image_cle, x.vignette_cle, null, coalesce(x.actif, true), v_marque);
    v_crees := v_crees + 1;
  end loop;

  return jsonb_build_object('crees', v_crees, 'ignores', v_ignores);
end $$;

revoke execute on function importer_catalogue(uuid, jsonb) from public, anon, authenticated;
grant execute on function importer_catalogue(uuid, jsonb) to authenticated;
