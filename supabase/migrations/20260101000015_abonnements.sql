-- Abonnements (section 11) : factures d'échéance, confirmation idempotente d'un paiement, paiement manuel,
-- changement de plan, cycle de vie (essai -> actif -> en retard -> suspendu) et relances.
-- Les fonctions « système » ne sont appelables que par le serveur (service_role), jamais par un navigateur.

alter table factures_abonnement
  add column lien_paiement text,
  add column trans_id text unique,
  add column lien_expire_le timestamptz,
  add column mois_couverts int not null default 1 check (mois_couverts between 1 and 12),
  add column plan_code text references plans(code);

-- Une seule facture d'abonnement par échéance (hors annulée) : générer deux fois ne crée rien de plus.
create unique index factures_une_par_echeance on factures_abonnement (abonnement_id, echeance)
  where type = 'abonnement' and statut <> 'annulee';

alter table envois_whatsapp
  add column facture_id uuid references factures_abonnement(id),
  add column etape text check (etape in ('j-3', 'j', 'j+2', 'j+5')),
  add column tentatives int not null default 0;
-- Jamais deux relances de la même étape pour la même facture.
create unique index relances_une_par_etape on envois_whatsapp (facture_id, etape) where type = 'relance';

-- ---------------------------------------------------------------------------------------------------------
-- Aides
-- ---------------------------------------------------------------------------------------------------------

-- Prix d'une période : 1 mois = prix du plan ; 12 mois = 10 mois payés (2 mois offerts, paiement manuel).
create function prix_periode(p_plan text, p_mois int) returns bigint language sql stable set search_path = public as $$
  select case when p_mois = 12 then prix_mensuel * 10 else prix_mensuel * p_mois end from plans where code = p_plan
$$;

-- État d'abonnement visible par tout membre de l'organisation (la table est réservée au propriétaire par la RLS).
create function abonnement_statut() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('statut', a.statut, 'prochaine_echeance', a.prochaine_echeance,
                            'fin_grace', a.fin_grace, 'fin_essai', a.fin_essai, 'plan_en_attente', a.plan_en_attente)
  from abonnements a where a.organisation_id = app_org_id()
$$;

-- Prolonge l'abonnement de p_mois. Payé à temps (essai ou actif) : la période suit l'échéance, sans perdre de jours.
-- Payé en retard (en retard ou suspendu) : la période démarre au paiement. La descente de plan prend effet ici.
create function appliquer_periode(p_abonnement uuid, p_mois int) returns void language plpgsql security definer set search_path = public as $$
declare a abonnements; v_base timestamptz; v_plan text;
begin
  select * into a from abonnements where id = p_abonnement for update;
  v_base := case when a.statut in ('essai', 'actif') then greatest(coalesce(a.prochaine_echeance, now()), now()) else now() end;
  v_plan := coalesce(a.plan_en_attente, a.plan_code);
  update abonnements set statut = 'actif', prochaine_echeance = v_base + make_interval(months => p_mois),
         fin_grace = null, fin_essai = null, plan_code = v_plan, plan_en_attente = null
   where id = a.id;
  update organisations set plan_code = v_plan where id = a.organisation_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Facture d'une échéance : idempotente (jamais deux factures pour la même échéance)
-- ---------------------------------------------------------------------------------------------------------
create function facturer_echeance(p_org uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare a abonnements; v_plan text; v_id uuid := gen_random_uuid(); v_existante uuid;
begin
  select * into a from abonnements where organisation_id = p_org for update;
  if not found or a.statut = 'annule' or a.prochaine_echeance is null then return null; end if;
  select id into v_existante from factures_abonnement
   where abonnement_id = a.id and type = 'abonnement' and echeance = a.prochaine_echeance and statut <> 'annulee';
  if v_existante is not null then return v_existante; end if;
  -- Le prix est celui du plan de la prochaine période : une descente demandée s'applique à cette facture.
  select coalesce(a.plan_en_attente, o.plan_code) into v_plan from organisations o where o.id = p_org;
  insert into factures_abonnement (id, organisation_id, abonnement_id, type, montant_brut, echeance, mode, external_id, plan_code)
  values (v_id, p_org, a.id, 'abonnement', prix_periode(v_plan, 1), a.prochaine_echeance, 'fapshi', v_id::text, v_plan);
  return v_id;
end $$;

-- Facture d'une prestation unique (frais d'installation) : montant réglable, payable par lien Fapshi.
create function creer_facture_installation(p_org uuid, p_montant bigint, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a abonnements; v_id uuid := gen_random_uuid();
begin
  if not app_est_admin() then raise exception 'Réservé à l''administrateur de la plateforme.'; end if;
  if p_montant is null or p_montant < 100 then raise exception 'Le montant doit être d''au moins 100 FCFA.'; end if;
  select * into a from abonnements where organisation_id = p_org;
  if not found then raise exception 'Organisation introuvable.'; end if;
  insert into factures_abonnement (id, organisation_id, abonnement_id, type, montant_brut, mode, external_id, note)
  values (v_id, p_org, a.id, 'installation', p_montant, 'fapshi', v_id::text, p_note);
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'facture_installation_creee', p_org::text, jsonb_build_object('facture', v_id, 'montant', p_montant));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Confirmation d'un paiement Fapshi : atomique et idempotente
-- ---------------------------------------------------------------------------------------------------------
-- Retourne : confirme | deja_traite (évènement déjà vu) | deja_payee (facture déjà payée par un autre évènement)
--            facture_inconnue | facture_annulee | montant_incorrect  (les trois derniers : argent reçu, revue manuelle).
create function confirmer_paiement_abonnement(
  p_evenement_id text, p_facture_id uuid, p_montant bigint, p_frais bigint, p_contenu jsonb, p_trans_id text default null
) returns text language plpgsql security definer set search_path = public as $$
declare v_ev uuid; f factures_abonnement; v_resultat text;
begin
  insert into evenements_paiement (fournisseur, evenement_id, contenu) values ('fapshi', p_evenement_id, coalesce(p_contenu, '{}'))
  on conflict (fournisseur, evenement_id) do nothing returning id into v_ev;
  if v_ev is null then return 'deja_traite'; end if;

  select * into f from factures_abonnement where id = p_facture_id for update;
  if not found then
    v_resultat := 'facture_inconnue';
  elsif f.statut = 'payee' then
    v_resultat := 'deja_payee';
  elsif f.statut = 'annulee' then
    v_resultat := 'facture_annulee';
  elsif p_montant is distinct from f.montant_brut or p_frais < 0 or p_frais > p_montant then
    v_resultat := 'montant_incorrect';
  else
    update factures_abonnement set statut = 'payee', frais_paiement = p_frais, payee_le = now(),
           trans_id = coalesce(p_trans_id, trans_id), lien_paiement = null
     where id = f.id;
    if f.type = 'abonnement' then perform appliquer_periode(f.abonnement_id, f.mois_couverts); end if;
    v_resultat := 'confirme';
  end if;
  update evenements_paiement set statut_traitement = case v_resultat
      when 'confirme' then 'traite' when 'deja_payee' then 'ignore' else 'erreur' end
   where id = v_ev;
  return v_resultat;
end $$;

-- Paiement reçu hors Fapshi (transfert Mobile Money direct, espèces) ou abonnement annuel avec remise.
create function enregistrer_paiement_manuel(
  p_org uuid, p_type text, p_montant bigint, p_mois int, p_reference text, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare a abonnements; v_id uuid := gen_random_uuid(); v_echeance timestamptz;
begin
  if not app_est_admin() then raise exception 'Réservé à l''administrateur de la plateforme.'; end if;
  if p_type not in ('abonnement', 'installation') then raise exception 'Type de paiement inconnu.'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant doit être positif.'; end if;
  if p_mois is null or p_mois not in (1, 12) then raise exception 'La durée doit être de 1 ou 12 mois.'; end if;
  if length(trim(coalesce(p_reference, ''))) = 0 then raise exception 'La référence du paiement est obligatoire.'; end if;
  select * into a from abonnements where organisation_id = p_org for update;
  if not found then raise exception 'Organisation introuvable.'; end if;
  v_echeance := case when p_type = 'abonnement' then a.prochaine_echeance end;
  -- Une facture Fapshi encore ouverte pour la même échéance est annulée : elle ne doit pas être payée en double.
  if p_type = 'abonnement' then
    update factures_abonnement set statut = 'annulee', lien_paiement = null
     where abonnement_id = a.id and type = 'abonnement' and echeance = v_echeance and statut = 'a_payer';
  end if;
  insert into factures_abonnement (id, organisation_id, abonnement_id, type, montant_brut, echeance, statut, mode, note,
                                   payee_le, mois_couverts, plan_code)
  values (v_id, p_org, a.id, p_type, p_montant, v_echeance, 'payee', 'manuel',
          trim(p_reference) || coalesce(' — ' || nullif(trim(p_note), ''), ''), now(),
          case when p_type = 'abonnement' then p_mois else 1 end,
          case when p_type = 'abonnement' then (select plan_code from organisations where id = p_org) end);
  if p_type = 'abonnement' then perform appliquer_periode(a.id, p_mois); end if;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'paiement_manuel_enregistre', p_org::text,
          jsonb_build_object('facture', v_id, 'type', p_type, 'montant', p_montant, 'mois', p_mois, 'reference', trim(p_reference)));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Changement de plan : la montée est immédiate, la descente prend effet à la fin de la période. Rien n'est supprimé.
-- ---------------------------------------------------------------------------------------------------------
create function changer_plan(p_org uuid, p_plan text) returns text language plpgsql security definer set search_path = public as $$
declare v_actuel plans; v_nouveau plans; v_resultat text;
begin
  if not app_est_admin() then raise exception 'Réservé à l''administrateur de la plateforme.'; end if;
  select p.* into v_actuel from plans p join organisations o on o.plan_code = p.code where o.id = p_org;
  select * into v_nouveau from plans where code = p_plan;
  if v_actuel.code is null or v_nouveau.code is null then raise exception 'Plan ou organisation introuvable.'; end if;
  if v_nouveau.ordre > v_actuel.ordre then
    update organisations set plan_code = v_nouveau.code where id = p_org;
    update abonnements set plan_code = v_nouveau.code, plan_en_attente = null where organisation_id = p_org;
    v_resultat := 'immediat';
  elsif v_nouveau.ordre < v_actuel.ordre then
    update abonnements set plan_en_attente = v_nouveau.code where organisation_id = p_org;
    v_resultat := 'fin_de_periode';
  else
    update abonnements set plan_en_attente = null where organisation_id = p_org;
    v_resultat := 'inchange';
  end if;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'plan_change', p_org::text, jsonb_build_object('de', v_actuel.code, 'vers', v_nouveau.code, 'effet', v_resultat));
  return v_resultat;
end $$;

-- Le propriétaire choisit son plan pour la prochaine facture (essai terminé ou renouvellement). Le plan s'applique au paiement ;
-- une facture ouverte à un autre prix est annulée et sera régénérée. Les droits actuels ne changent pas avant le paiement.
create function choisir_plan(p_plan text) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := app_org_id();
begin
  if v_org is null or app_role() <> 'proprietaire' then raise exception 'Seul le propriétaire peut choisir le plan.'; end if;
  -- Un plan non public se négocie avec l'administrateur (changer_plan) ; on peut toujours garder son plan actuel.
  if not exists (select 1 from plans where code = p_plan and (visible_public or code = (select plan_code from organisations where id = v_org))) then
    raise exception 'Ce plan n''est pas disponible.';
  end if;
  update abonnements set plan_en_attente = case when p_plan = plan_code then null else p_plan end where organisation_id = v_org;
  update factures_abonnement set statut = 'annulee', lien_paiement = null
   where organisation_id = v_org and type = 'abonnement' and statut = 'a_payer' and plan_code is distinct from p_plan;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'plan_choisi', v_org::text, jsonb_build_object('plan', p_plan));
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- Tâche planifiée : cycle de vie et factures à venir
-- ---------------------------------------------------------------------------------------------------------
-- Essai ou période terminés sans paiement -> en retard (délai de grâce) ; délai de grâce écoulé -> suspendu (lecture seule) ;
-- facture générée 3 jours avant l'échéance. Aucune donnée supprimée.
create function traiter_echeances() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_grace int; v_en_retard int; v_suspendus int; v_factures int := 0; r record;
begin
  select grace_jours into v_grace from parametres_plateforme;
  with m as (
    update abonnements set statut = 'en_retard', fin_grace = prochaine_echeance + make_interval(days => v_grace)
     where statut in ('essai', 'actif') and prochaine_echeance <= now() returning 1)
  select count(*) into v_en_retard from m;
  with m as (
    update abonnements set statut = 'suspendu' where statut = 'en_retard' and fin_grace <= now() returning 1)
  select count(*) into v_suspendus from m;
  for r in select organisation_id from abonnements
            where statut in ('essai', 'actif', 'en_retard') and prochaine_echeance <= now() + interval '3 days' loop
    if not exists (select 1 from factures_abonnement f join abonnements a on a.id = f.abonnement_id
                    where a.organisation_id = r.organisation_id and f.type = 'abonnement' and f.echeance = a.prochaine_echeance
                      and f.statut <> 'annulee') then
      perform facturer_echeance(r.organisation_id);
      v_factures := v_factures + 1;
    end if;
  end loop;
  return jsonb_build_object('en_retard', v_en_retard, 'suspendus', v_suspendus, 'factures', v_factures);
end $$;

-- Étape de relance d'une échéance à un instant donné : J-3, J, J+2, J+5 (fenêtres qui ne se chevauchent pas ;
-- une étape manquée par une panne n'est pas rattrapée longtemps après).
create function etape_relance(p_echeance timestamptz, p_maintenant timestamptz) returns text language sql immutable as $$
  select case
    when p_maintenant >= p_echeance - interval '3 days' and p_maintenant < p_echeance then 'j-3'
    when p_maintenant >= p_echeance and p_maintenant < p_echeance + interval '2 days' then 'j'
    when p_maintenant >= p_echeance + interval '2 days' and p_maintenant < p_echeance + interval '5 days' then 'j+2'
    when p_maintenant >= p_echeance + interval '5 days' and p_maintenant < p_echeance + interval '8 days' then 'j+5'
  end
$$;

-- Réserve les relances à envoyer (une ligne `en_attente` par facture et par étape : jamais deux fois) et les renvoie.
-- Un échec peut être retenté jusqu'à 3 fois. L'envoi lui-même (Zernio) est fait par le serveur, qui met à jour la ligne.
create function reserver_relances() returns table (
  envoi_id uuid, organisation_id uuid, facture_id uuid, etape text, destinataire text, boutique_nom text, montant bigint, echeance timestamptz
) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_id uuid;
begin
  for r in
    select f.id as fid, f.organisation_id as oid, f.montant_brut, f.echeance as ech, etape_relance(f.echeance, now()) as et,
           o.telephone, (select b.nom from boutiques b where b.organisation_id = o.id order by b.cree_le limit 1) as bnom
      from factures_abonnement f
      join abonnements a on a.id = f.abonnement_id and a.statut in ('essai', 'actif', 'en_retard', 'suspendu')
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

revoke execute on function prix_periode(text, int), abonnement_statut(), appliquer_periode(uuid, int), facturer_echeance(uuid),
  creer_facture_installation(uuid, bigint, text), confirmer_paiement_abonnement(text, uuid, bigint, bigint, jsonb, text),
  enregistrer_paiement_manuel(uuid, text, bigint, int, text, text), changer_plan(uuid, text), choisir_plan(text), traiter_echeances(),
  etape_relance(timestamptz, timestamptz), reserver_relances() from public, anon, authenticated;
grant execute on function prix_periode(text, int), appliquer_periode(uuid, int), facturer_echeance(uuid),
  confirmer_paiement_abonnement(text, uuid, bigint, bigint, jsonb, text), traiter_echeances(), etape_relance(timestamptz, timestamptz),
  reserver_relances() to service_role;
-- Fonctions réservées à l'administrateur (contrôle app_est_admin() dans le corps) et lecture par tout membre.
grant execute on function creer_facture_installation(uuid, bigint, text), enregistrer_paiement_manuel(uuid, text, bigint, int, text, text),
  changer_plan(uuid, text) to authenticated;
grant execute on function abonnement_statut(), choisir_plan(text) to authenticated;
