-- 17 : plus aucun essai gratuit. Le premier paiement est attendu dès l'inscription (puis jours de grâce), les trois formules
-- sont visibles publiquement.

alter table abonnements drop constraint if exists abonnements_statut_check;
update abonnements set statut = 'en_attente' where statut = 'essai';
alter table abonnements add constraint abonnements_statut_check check (statut in ('en_attente', 'actif', 'en_retard', 'suspendu', 'annule'));
alter table abonnements alter column statut set default 'en_attente';
create or replace function abonnement_statut() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('statut', a.statut, 'prochaine_echeance', a.prochaine_echeance,
                            'fin_grace', a.fin_grace, 'plan_en_attente', a.plan_en_attente)
  from abonnements a where a.organisation_id = app_org_id()
$$;

create or replace function appliquer_periode(p_abonnement uuid, p_mois int) returns void language plpgsql security definer set search_path = public as $$
declare a abonnements; v_base timestamptz; v_plan text;
begin
  select * into a from abonnements where id = p_abonnement for update;
  v_base := case when a.statut in ('en_attente', 'actif') then greatest(coalesce(a.prochaine_echeance, now()), now()) else now() end;
  v_plan := coalesce(a.plan_en_attente, a.plan_code);
  update abonnements set statut = 'actif', prochaine_echeance = v_base + make_interval(months => p_mois),
         fin_grace = null, plan_code = v_plan, plan_en_attente = null
   where id = a.id;
  update organisations set plan_code = v_plan where id = a.organisation_id;
end $$;

create or replace function traiter_echeances() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_grace int; v_en_retard int; v_suspendus int; v_factures int := 0; r record;
begin
  select grace_jours into v_grace from parametres_plateforme;
  with m as (
    update abonnements set statut = 'en_retard', fin_grace = prochaine_echeance + make_interval(days => v_grace)
     where statut in ('en_attente', 'actif') and prochaine_echeance <= now() returning 1)
  select count(*) into v_en_retard from m;
  with m as (
    update abonnements set statut = 'suspendu' where statut = 'en_retard' and fin_grace <= now() returning 1)
  select count(*) into v_suspendus from m;
  for r in select organisation_id from abonnements
            where statut in ('en_attente', 'actif', 'en_retard') and prochaine_echeance <= now() + interval '3 days' loop
    if not exists (select 1 from factures_abonnement f join abonnements a on a.id = f.abonnement_id
                    where a.organisation_id = r.organisation_id and f.type = 'abonnement' and f.echeance = a.prochaine_echeance
                      and f.statut <> 'annulee') then
      perform facturer_echeance(r.organisation_id);
      v_factures := v_factures + 1;
    end if;
  end loop;
  return jsonb_build_object('en_retard', v_en_retard, 'suspendus', v_suspendus, 'factures', v_factures);
end $$;

create or replace function reserver_relances() returns table (
  envoi_id uuid, organisation_id uuid, facture_id uuid, etape text, destinataire text, boutique_nom text, montant bigint, echeance timestamptz
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_id uuid;
begin
  for r in
    select f.id as fid, f.organisation_id as oid, f.montant_brut, f.echeance as ech, etape_relance(f.echeance, now()) as et,
           o.telephone, (select b.nom from boutiques b where b.organisation_id = o.id order by b.cree_le limit 1) as bnom
      from factures_abonnement f
      join abonnements a on a.id = f.abonnement_id and a.statut in ('en_attente', 'actif', 'en_retard', 'suspendu')
      join organisations o on o.id = f.organisation_id
     where f.type = 'abonnement' and f.statut = 'a_payer' and f.echeance is not null and o.telephone is not null
  loop
    continue when r.et is null;
    insert into envois_whatsapp (organisation_id, destinataire, type, facture_id, etape, tentatives)
    values (r.oid, r.telephone, 'relance', r.fid, r.et, 1)
    on conflict (facture_id, etape) where type = 'relance' do update
       set statut = 'en_attente', tentatives = envois_whatsapp.tentatives + 1, erreur = null
     where envois_whatsapp.tentatives < 3
       and (envois_whatsapp.statut = 'echec' or (envois_whatsapp.statut = 'en_attente' and envois_whatsapp.cree_le < now() - interval '1 hour'))
    returning id into v_id;
    if v_id is not null then
      envoi_id := v_id; organisation_id := r.oid; facture_id := r.fid; etape := r.et; destinataire := r.telephone;
      boutique_nom := r.bnom; montant := r.montant_brut; echeance := r.ech;
      return next;
    end if;
    v_id := null;
  end loop;
end $$;

create or replace function creer_organisation(
  p_nom text, p_nom_boutique text, p_ville text default null, p_telephone text default null,
  p_code_parrainage text default null, p_source text default 'lien'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_boutique uuid; v_aff affilies;
begin
  if auth.uid() is null then raise exception 'Vous devez être connecté.'; end if;
  if exists (select 1 from membres where utilisateur_id = auth.uid()) then
    raise exception 'Ce compte appartient déjà à une boutique.';
  end if;
  if length(trim(coalesce(p_nom, ''))) = 0 or length(trim(coalesce(p_nom_boutique, ''))) = 0 then
    raise exception 'Le nom de l''entreprise et de la boutique est obligatoire.';
  end if;
  insert into organisations (nom, ville, telephone) values (trim(p_nom), nullif(trim(p_ville), ''), p_telephone) returning id into v_org;
  insert into boutiques (organisation_id, nom, telephone) values (v_org, trim(p_nom_boutique), p_telephone) returning id into v_boutique;
  insert into parametres_boutique (boutique_id, organisation_id) values (v_boutique, v_org);
  insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees)
  values (auth.uid(), v_org, 'proprietaire', array[v_boutique]);
  insert into abonnements (organisation_id, plan_code, statut, prochaine_echeance)
  values (v_org, 'essentiel', 'en_attente', now());

  if nullif(trim(p_code_parrainage), '') is not null then
    select * into v_aff from affilies where code = upper(trim(p_code_parrainage)) and actif;
    if found then
      if v_aff.utilisateur_id = auth.uid()
         or (p_telephone is not null and v_aff.telephone = p_telephone)
         or exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = lower(coalesce(v_aff.email, ''))) then
        perform ecrire_journal(v_org, v_boutique, 'auto_parrainage_refuse', 'affilie', v_aff.id::text, '{}', true);
      else
        insert into parrainages (affilie_id, organisation_id, source)
        values (v_aff.id, v_org, case when p_source = 'code' then 'code' else 'lien' end);
      end if;
    end if;
  end if;
  perform ecrire_journal(v_org, v_boutique, 'organisation_creee', 'organisation', v_org::text, '{}');
  return jsonb_build_object('organisation_id', v_org, 'boutique_id', v_boutique);
end $$;

create or replace function programme_partenaire_public() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'commission_pourcentage', commission_pourcentage,
    'duree_mois', commission_duree_mois,
    'seuil_versement', seuil_versement,
    'retention_jours', retention_jours
  ) from parametres_plateforme
$$;

alter table abonnements drop column if exists fin_essai;
alter table parametres_plateforme drop column if exists essai_jours;

-- Les trois formules sont affichées au public ; celles dont des fonctions ne sont pas encore livrées le disent à l'écran.
update plans set visible_public = true where code in ('essentiel', 'pro', 'business');
