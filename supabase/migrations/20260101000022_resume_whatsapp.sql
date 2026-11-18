-- Résumé WhatsApp quotidien envoyé au propriétaire (plans avec la fonction « resume_whatsapp »).
-- Désactivé par défaut : le propriétaire l'active dans Paramètres. Un seul envoi par boutique et par jour (heure de Douala).

create table resume_whatsapp_reglages (
  organisation_id uuid primary key references organisations(id),
  actif boolean not null default false,
  modifie_le timestamptz not null default now()
);
alter table resume_whatsapp_reglages enable row level security;
revoke all on resume_whatsapp_reglages from anon, authenticated;
grant select on resume_whatsapp_reglages to authenticated;
create policy lecture on resume_whatsapp_reglages for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire');

alter table envois_whatsapp add column jour date;
create unique index resume_un_par_jour on envois_whatsapp (organisation_id, jour) where type = 'resume_quotidien';

-- Le propriétaire active ou coupe le résumé. L'activer demande un plan qui l'inclut et un numéro WhatsApp enregistré.
create function regler_resume_whatsapp(p_actif boolean) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := app_org_id();
begin
  if v_org is null or app_role() <> 'proprietaire' then raise exception 'Seul le propriétaire peut régler le résumé.'; end if;
  if p_actif then
    if not plan_permet(v_org, 'resume_whatsapp') then raise exception 'Le résumé WhatsApp est inclus dans le plan Pro.'; end if;
    if not exists (select 1 from organisations where id = v_org and nullif(trim(coalesce(telephone, '')), '') is not null) then
      raise exception 'Ajoutez votre numéro WhatsApp dans les paramètres de la boutique.';
    end if;
  end if;
  insert into resume_whatsapp_reglages (organisation_id, actif) values (v_org, p_actif)
  on conflict (organisation_id) do update set actif = excluded.actif, modifie_le = now();
end $$;

-- Calcule et réserve les résumés du jour. Retentés jusqu'à 3 fois en cas d'échec ; jamais deux fois le même jour.
-- Aucune donnée de marge ni de prix d'achat : seulement ventes, produit phare, stock bas et crédits clients.
create function reserver_resumes(p_jour date default (now() at time zone 'Africa/Douala')::date) returns table (
  envoi_id uuid, organisation_id uuid, destinataire text, boutique_nom text,
  ventes_total bigint, nb_ventes int, produit_phare text, stock_bas int, credits bigint
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_id uuid; v_total bigint; v_nb int; v_top text; v_bas int; v_cred bigint;
begin
  for r in
    select o.id as oid, o.telephone as tel,
           (select b.nom from boutiques b where b.organisation_id = o.id order by b.cree_le limit 1) as bnom
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
      left join (select produit_id, sum(quantite) q from stock_courant where organisation_id = r.oid group by produit_id) s on s.produit_id = p.id
     where p.organisation_id = r.oid and p.archive_le is null and p.actif and p.seuil_alerte > 0 and coalesce(s.q, 0) < p.seuil_alerte;
    select coalesce(sum(solde), 0) into v_cred from creances where organisation_id = r.oid and statut = 'ouverte';

    envoi_id := v_id; organisation_id := r.oid; destinataire := r.tel; boutique_nom := r.bnom;
    ventes_total := v_total; nb_ventes := v_nb; produit_phare := v_top; stock_bas := v_bas; credits := v_cred;
    return next;
    v_id := null;
  end loop;
end $$;

revoke execute on function regler_resume_whatsapp(boolean), reserver_resumes(date) from public, anon, authenticated;
grant execute on function regler_resume_whatsapp(boolean) to authenticated;
grant execute on function reserver_resumes(date) to service_role;
