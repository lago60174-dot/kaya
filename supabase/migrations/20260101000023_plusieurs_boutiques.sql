-- Plusieurs boutiques par compte (section 9.12, plan Business).
-- Le socle existait déjà : catalogue, clients et prix d'achat au niveau de l'organisation ; stock, ventes, crédits,
-- dépenses, caisse, numérotation des reçus et journal par boutique. Cette migration ajoute ce qui manquait.
-- Les migrations 1 à 22 ne sont pas modifiées.

-- ── Lecture seule hors plan ────────────────────────────────────────────────────────────────────────────────────
-- Une boutique est « dans le plan » si son rang d'ancienneté est inférieur ou égal à la limite de boutiques du plan.
-- Après une descente de plan, les boutiques en trop restent consultables mais ne se modifient plus (rien n'est supprimé).
create function boutique_en_ecriture(p_boutique uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid; v_cree timestamptz; v_max int; v_rang int;
begin
  select organisation_id, cree_le into v_org, v_cree from boutiques where id = p_boutique;
  if v_org is null then return true; end if;
  if not exists (select 1 from plans p join organisations o on o.plan_code = p.code where o.id = v_org) then return true; end if;
  v_max := plan_limite(v_org, 'boutiques');
  if v_max is null then return true; end if;
  select count(*) into v_rang from boutiques b where b.organisation_id = v_org and (b.cree_le, b.id) <= (v_cree, p_boutique);
  return v_rang <= v_max;
end $$;

create function verifier_boutique_en_ecriture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not boutique_en_ecriture(new.boutique_id) then
    raise exception 'Cette boutique dépasse ce que permet votre abonnement : elle est en lecture seule.';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ventes', 'mouvements_stock', 'depenses', 'paiements', 'clotures_caisse', 'avoirs'] loop
    execute format('create trigger trg_boutique_en_ecriture before insert or update on %I for each row execute function verifier_boutique_en_ecriture()', t);
  end loop;
end $$;

-- ── Liste des boutiques accessibles (RLS : tout pour le propriétaire, les boutiques attribuées pour un vendeur) ──
create function lister_boutiques() returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'nom', b.nom, 'adresse', b.adresse, 'telephone', b.telephone,
           'en_ecriture', boutique_en_ecriture(b.id)) order by b.cree_le, b.id), '[]'::jsonb)
    from boutiques b
$$;

-- ── Ajouter une boutique ─────────────────────────────────────────────────────────────────────────────────────────
create function creer_boutique(p_nom text, p_adresse text default null, p_telephone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m membres; v_nom text := trim(coalesce(p_nom, '')); v_id uuid;
begin
  select * into m from membres where utilisateur_id = auth.uid() and actif;
  if not found then raise exception 'Vous devez être connecté.'; end if;
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut ajouter une boutique.'; end if;
  perform verifier_ecriture(m.organisation_id);
  if not plan_permet(m.organisation_id, 'multi_boutiques') then
    raise exception 'La gestion de plusieurs boutiques n''est pas incluse dans votre abonnement.';
  end if;
  if length(v_nom) = 0 then raise exception 'Indiquez le nom de la boutique.'; end if;
  if length(v_nom) > 80 then raise exception 'Ce nom est trop long (80 caractères maximum).'; end if;
  if length(coalesce(p_adresse, '')) > 200 then raise exception 'Cette adresse est trop longue (200 caractères maximum).'; end if;
  if length(coalesce(p_telephone, '')) > 30 then raise exception 'Ce numéro est trop long.'; end if;
  -- Verrou sur l'organisation : deux créations simultanées ne peuvent pas dépasser la limite du plan.
  perform 1 from organisations where id = m.organisation_id for update;
  if exists (select 1 from boutiques where organisation_id = m.organisation_id and lower(nom) = lower(v_nom)) then
    raise exception 'Vous avez déjà une boutique avec ce nom.';
  end if;
  insert into boutiques (organisation_id, nom, adresse, telephone)
  values (m.organisation_id, v_nom, nullif(trim(coalesce(p_adresse, '')), ''), nullif(trim(coalesce(p_telephone, '')), ''))
  returning id into v_id; -- la limite du plan est contrôlée par trg_limite_boutiques
  insert into parametres_boutique (boutique_id, organisation_id) values (v_id, m.organisation_id);
  perform ecrire_journal(m.organisation_id, v_id, 'boutique_creee', 'boutique', v_id::text, jsonb_build_object('nom', v_nom));
  return jsonb_build_object('id', v_id, 'nom', v_nom);
end $$;

-- ── Boutiques d'un vendeur ───────────────────────────────────────────────────────────────────────────────────────
create function definir_boutiques_vendeur(p_membre uuid, p_boutiques uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare m membres; v membres; v_ids uuid[]; v_noms text;
begin
  select * into m from membres where utilisateur_id = auth.uid() and actif;
  if not found then raise exception 'Vous devez être connecté.'; end if;
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut attribuer des boutiques.'; end if;
  perform verifier_ecriture(m.organisation_id);
  select * into v from membres where id = p_membre and organisation_id = m.organisation_id and role = 'vendeur' for update;
  if not found then raise exception 'Vendeur introuvable.'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_boutiques, '{}')) x;
  if cardinality(v_ids) = 0 then raise exception 'Choisissez au moins une boutique pour ce vendeur.'; end if;
  if exists (select 1 from unnest(v_ids) x where not exists (select 1 from boutiques b where b.id = x and b.organisation_id = m.organisation_id)) then
    raise exception 'Boutique introuvable.';
  end if;
  update membres set boutiques_autorisees = v_ids, modifie_le = now() where id = v.id;
  select string_agg(nom, ', ' order by nom) into v_noms from boutiques where id = any (v_ids);
  perform ecrire_journal(m.organisation_id, null, 'vendeur_boutiques_modifiees', 'membre', v.id::text,
    jsonb_build_object('vendeur', v.nom, 'boutiques', v_noms));
end $$;

-- ── Tableau de bord consolidé : une ligne par boutique, en un seul appel ────────────────────────────────────────
create function tableau_de_bord_consolide() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m membres; b record; t jsonb; c jsonb; v_res jsonb := '[]'::jsonb;
begin
  select * into m from membres where utilisateur_id = auth.uid() and actif;
  if not found then raise exception 'Vous devez être connecté.'; end if;
  if m.role <> 'proprietaire' then raise exception 'Le tableau de bord est réservé au propriétaire.'; end if;
  for b in select id, nom from boutiques where organisation_id = m.organisation_id order by cree_le, id loop
    t := tableau_de_bord(b.id);
    c := t -> 'caisse';
    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'boutique_id', b.id, 'nom', b.nom, 'en_ecriture', boutique_en_ecriture(b.id),
      'ventes_total', c -> 'ventes_total', 'nb_ventes', c -> 'nb_ventes', 'ventes_hier', t -> 'ventes_hier',
      'especes_attendues', c -> 'especes_attendues',
      'mobile_money', ((c ->> 'mtn_momo')::numeric - (c ->> 'mtn_momo_rembourse')::numeric)
                    + ((c ->> 'orange_money')::numeric - (c ->> 'orange_money_rembourse')::numeric),
      'depenses_total', c -> 'depenses_total', 'credit_accorde', c -> 'credit_accorde',
      'dettes_total', t #> '{dettes,total}', 'nb_debiteurs', t #> '{dettes,nb_clients}',
      'stock_bas', t #> '{stock_bas,nombre}', 'clotures_a_valider', t -> 'clotures_a_valider'));
  end loop;
  return jsonb_build_object('jour', (now() at time zone 'Africa/Douala')::date, 'boutiques', v_res);
end $$;

-- ── Résumé WhatsApp : correct avec plusieurs boutiques ──────────────────────────────────────────────────────────
-- Le résumé additionne toutes les boutiques ; il porte donc le nom de l'organisation (et non celui de la 1re boutique),
-- et le « stock bas » compte les produits sous leur seuil dans au moins une boutique (et non sur le total).
create or replace function reserver_resumes(p_jour date default (now() at time zone 'Africa/Douala')::date) returns table (
  envoi_id uuid, organisation_id uuid, destinataire text, boutique_nom text,
  ventes_total bigint, nb_ventes int, produit_phare text, stock_bas int, credits bigint
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_id uuid; v_total bigint; v_nb int; v_top text; v_bas int; v_cred bigint;
begin
  for r in
    select o.id as oid, o.telephone as tel,
           (select case when count(*) > 1 then o.nom || ' (' || count(*) || ' boutiques)' else max(b.nom) end
              from boutiques b where b.organisation_id = o.id) as bnom
      from resume_whatsapp_reglages g
      join organisations o on o.id = g.organisation_id
      join abonnements a on a.organisation_id = o.id and a.statut in ('actif', 'en_attente', 'en_retard')
     where g.actif and plan_permet(o.id, 'resume_whatsapp') and nullif(trim(coalesce(o.telephone, '')), '') is not null
  loop
    insert into envois_whatsapp (organisation_id, destinataire, type, jour, tentatives)
    values (r.oid, r.tel, 'resume_quotidien', p_jour, 1)
    on conflict (organisation_id, jour) where type = 'resume_quotidien' do update
       set statut = 'en_attente', tentatives = envois_whatsapp.tentatives + 1, erreur = null
     where envois_whatsapp.tentatives < 3
       and (envois_whatsapp.statut = 'echec' or (envois_whatsapp.statut = 'en_attente' and envois_whatsapp.cree_le < now() - interval '1 hour'))
    returning id into v_id;
    if v_id is null then continue; end if;

    select coalesce(sum(total), 0), count(*) into v_total, v_nb from ventes
     where organisation_id = r.oid and statut = 'valide' and (date at time zone 'Africa/Douala')::date = p_jour;
    select max(t.nom) into v_top from (
      select vl.nom_produit as nom from vente_lignes vl join ventes v on v.id = vl.vente_id
       where v.organisation_id = r.oid and v.statut = 'valide' and (v.date at time zone 'Africa/Douala')::date = p_jour
       group by vl.produit_id, vl.nom_produit order by sum(vl.total_ligne) desc, vl.nom_produit limit 1) t;
    select count(*) into v_bas from produits p
     where p.organisation_id = r.oid and p.archive_le is null and p.actif and p.seuil_alerte > 0
       and exists (select 1 from boutiques b
                    left join stock_courant s on s.boutique_id = b.id and s.produit_id = p.id
                   where b.organisation_id = r.oid and coalesce(s.quantite, 0) < p.seuil_alerte);
    select coalesce(sum(solde), 0) into v_cred from creances where organisation_id = r.oid and statut = 'ouverte';

    envoi_id := v_id; organisation_id := r.oid; destinataire := r.tel; boutique_nom := r.bnom;
    ventes_total := v_total; nb_ventes := v_nb; produit_phare := v_top; stock_bas := v_bas; credits := v_cred;
    return next;
    v_id := null;
  end loop;
end $$;

revoke execute on function boutique_en_ecriture(uuid), verifier_boutique_en_ecriture(), lister_boutiques(),
  creer_boutique(text, text, text), definir_boutiques_vendeur(uuid, uuid[]), tableau_de_bord_consolide()
  from public, anon, authenticated;
grant execute on function boutique_en_ecriture(uuid), lister_boutiques(), creer_boutique(text, text, text),
  definir_boutiques_vendeur(uuid, uuid[]), tableau_de_bord_consolide() to authenticated;
