-- Panneau d'administration de la plateforme. Chaque fonction vérifie app_est_admin() : un propriétaire ou un vendeur ne peut rien lire ici.
-- Journée en heure de Douala ; aucune donnée n'est supprimée.

create function admin_exiger() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not app_est_admin() then raise exception 'Réservé à l''administrateur de la plateforme.'; end if;
end $$;

-- Vue d'ensemble : boutiques, statuts d'abonnement, revenu mensuel estimé, encaissements, points d'attention.
create function admin_resume() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform admin_exiger();
  select jsonb_build_object(
    'boutiques', (select count(*) from organisations),
    'inscrites_7j', (select count(*) from organisations where cree_le > now() - interval '7 days'),
    'inscrites_30j', (select count(*) from organisations where cree_le > now() - interval '30 days'),
    'statuts', coalesce((select jsonb_object_agg(statut, n) from (select statut, count(*) n from abonnements group by statut) s), '{}'),
    'plans', coalesce((select jsonb_object_agg(plan_code, n) from (select plan_code, count(*) n from organisations group by plan_code) s), '{}'),
    'revenu_mensuel_estime', coalesce((select sum(p.prix_mensuel) from abonnements a join plans p on p.code = a.plan_code where a.statut = 'actif'), 0),
    'encaisse_30j', coalesce((select sum(montant_brut) from factures_abonnement where statut = 'payee' and payee_le > now() - interval '30 days'), 0),
    'a_encaisser', coalesce((select sum(montant_brut) from factures_abonnement where statut = 'a_payer'), 0),
    'actives_7j', (select count(distinct organisation_id) from ventes where statut = 'valide' and date > now() - interval '7 days'),
    'ventes_7j', (select count(*) from ventes where statut = 'valide' and date > now() - interval '7 days'),
    'demandes_partenaire', (select count(*) from demandes_partenaire where statut = 'a_valider'),
    'paiements_a_revoir', (select count(*) from evenements_paiement where statut_traitement = 'erreur')
  ) into v;
  return v;
end $$;

-- Liste des boutiques avec recherche (nom, ville, téléphone, email) et filtres statut / plan.
create function admin_boutiques(p_recherche text default null, p_statut text default null, p_plan text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_terme text := nullif(trim(coalesce(p_recherche, '')), ''); v jsonb;
begin
  perform admin_exiger();
  select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le desc), '[]') into v from (
    select o.id, o.nom, b.nom as boutique, coalesce(b.ville, o.ville) as ville, coalesce(o.telephone, b.telephone) as telephone,
           u.email as email, o.plan_code as plan, a.statut, a.prochaine_echeance, o.cree_le,
           (select count(*) from ventes v where v.organisation_id = o.id and v.statut = 'valide' and v.date > now() - interval '30 days') as ventes_30j,
           (select max(v.date) from ventes v where v.organisation_id = o.id and v.statut = 'valide') as derniere_vente
      from organisations o
      join abonnements a on a.organisation_id = o.id
      left join lateral (select * from boutiques x where x.organisation_id = o.id order by x.cree_le limit 1) b on true
      left join lateral (select m.utilisateur_id from membres m where m.organisation_id = o.id and m.role = 'proprietaire' order by m.cree_le limit 1) pr on true
      left join auth.users u on u.id = pr.utilisateur_id
     where (p_statut is null or p_statut = '' or a.statut = p_statut)
       and (p_plan is null or p_plan = '' or o.plan_code = p_plan)
       and (v_terme is null or o.nom ilike '%' || v_terme || '%' or b.nom ilike '%' || v_terme || '%'
            or coalesce(b.ville, o.ville, '') ilike '%' || v_terme || '%' or coalesce(o.telephone, b.telephone, '') ilike '%' || v_terme || '%'
            or coalesce(u.email, '') ilike '%' || v_terme || '%')
     order by o.cree_le desc limit 300
  ) t;
  return v;
end $$;

-- Fiche d'une boutique : identité, abonnement, activité, parrain, factures et historique des actions de l'administrateur.
create function admin_boutique(p_org uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform admin_exiger();
  select jsonb_build_object(
    'id', o.id, 'nom', o.nom, 'cree_le', o.cree_le, 'plan', o.plan_code,
    'boutique', (select jsonb_build_object('nom', b.nom, 'ville', coalesce(b.ville, o.ville), 'telephone', coalesce(o.telephone, b.telephone), 'email_boutique', b.email)
                   from boutiques b where b.organisation_id = o.id order by b.cree_le limit 1),
    'proprietaire', (select jsonb_build_object('nom', m.nom, 'email', u.email) from membres m join auth.users u on u.id = m.utilisateur_id
                      where m.organisation_id = o.id and m.role = 'proprietaire' order by m.cree_le limit 1),
    'abonnement', (select jsonb_build_object('statut', a.statut, 'plan', a.plan_code, 'plan_en_attente', a.plan_en_attente,
                          'prochaine_echeance', a.prochaine_echeance, 'fin_grace', a.fin_grace, 'debut', a.debut)
                     from abonnements a where a.organisation_id = o.id),
    'vendeurs', (select count(*) from membres where organisation_id = o.id and role = 'vendeur' and actif),
    'produits', (select count(*) from produits where organisation_id = o.id and archive_le is null),
    'clients', (select count(*) from clients where organisation_id = o.id),
    'ventes_30j', (select jsonb_build_object('nb', count(*), 'total', coalesce(sum(total), 0)) from ventes
                    where organisation_id = o.id and statut = 'valide' and date > now() - interval '30 days'),
    'derniere_vente', (select max(date) from ventes where organisation_id = o.id and statut = 'valide'),
    'parrain', (select jsonb_build_object('nom', af.nom, 'code', af.code) from parrainages pa join affilies af on af.id = pa.affilie_id where pa.organisation_id = o.id),
    'factures', coalesce((select jsonb_agg(to_jsonb(f) order by f.cree_le desc) from (
        select id, type, montant_brut, frais_paiement, statut, mode, echeance, payee_le, mois_couverts, plan_code, note, cree_le
          from factures_abonnement where organisation_id = o.id order by cree_le desc limit 20) f), '[]'),
    'journal', coalesce((select jsonb_agg(to_jsonb(j) order by j.cree_le desc) from (
        select action, details, cree_le from journal_audit where cible = o.id::text order by id desc limit 15) j), '[]')
  ) into v from organisations o where o.id = p_org;
  if v is null then raise exception 'Boutique introuvable.'; end if;
  return v;
end $$;

-- Suspendre (lecture seule), réactiver (jours offerts) ou annuler un abonnement. Rien n'est supprimé.
create function admin_changer_statut(p_org uuid, p_action text, p_jours int default 7, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a abonnements;
begin
  perform admin_exiger();
  select * into a from abonnements where organisation_id = p_org for update;
  if not found then raise exception 'Boutique introuvable.'; end if;
  if p_action = 'suspendre' then
    update abonnements set statut = 'suspendu' where id = a.id;
  elsif p_action = 'annuler' then
    update abonnements set statut = 'annule' where id = a.id;
  elsif p_action = 'reactiver' then
    if p_jours is null or p_jours < 1 or p_jours > 365 then raise exception 'Le nombre de jours doit être entre 1 et 365.'; end if;
    update abonnements set statut = 'actif', fin_grace = null,
           prochaine_echeance = greatest(coalesce(prochaine_echeance, now()), now()) + make_interval(days => p_jours)
     where id = a.id;
  else
    raise exception 'Action inconnue.';
  end if;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'statut_' || p_action, p_org::text,
          jsonb_build_object('jours', case when p_action = 'reactiver' then p_jours end, 'note', nullif(trim(coalesce(p_note, '')), ''), 'avant', a.statut));
end $$;

-- Prix et visibilité d'un plan. Le prix s'applique aux prochaines factures ; les factures déjà créées ne changent pas.
create function admin_modifier_plan(p_code text, p_prix bigint, p_visible boolean) returns void language plpgsql security definer set search_path = public as $$
declare p plans;
begin
  perform admin_exiger();
  select * into p from plans where code = p_code for update;
  if not found then raise exception 'Plan introuvable.'; end if;
  if p_prix is null or p_prix < 0 or p_prix > 10000000 then raise exception 'Prix invalide.'; end if;
  update plans set prix_mensuel = p_prix, visible_public = p_visible, modifie_le = now() where code = p_code;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'plan_modifie', p_code, jsonb_build_object('prix_avant', p.prix_mensuel, 'prix', p_prix, 'visible_avant', p.visible_public, 'visible', p_visible));
end $$;

-- Décision sur une demande « Devenir partenaire » (la création du compte partenaire se fait ensuite à la main).
create function admin_traiter_demande(p_id uuid, p_statut text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_exiger();
  if p_statut not in ('acceptee', 'refusee') then raise exception 'Décision inconnue.'; end if;
  update demandes_partenaire set statut = p_statut where id = p_id and statut = 'a_valider';
  if not found then raise exception 'Demande introuvable ou déjà traitée.'; end if;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'demande_partenaire_' || p_statut, p_id::text, '{}');
end $$;

revoke execute on function admin_exiger(), admin_resume(), admin_boutiques(text, text, text), admin_boutique(uuid),
  admin_changer_statut(uuid, text, int, text), admin_modifier_plan(text, bigint, boolean), admin_traiter_demande(uuid, text)
  from public, anon, authenticated;
grant execute on function admin_resume(), admin_boutiques(text, text, text), admin_boutique(uuid),
  admin_changer_statut(uuid, text, int, text), admin_modifier_plan(text, bigint, boolean), admin_traiter_demande(uuid, text) to authenticated;
