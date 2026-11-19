-- 24 : le plan est choisi explicitement à la création de la boutique, avant toute autre étape (paiement possible plus tard).
-- Tant que `plan_choisi_le` est vide, le propriétaire est renvoyé vers /choisir-plan.
-- Idempotent : remplace la migration « 20_plan_obligatoire » si elle a déjà été appliquée.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'organisations' and column_name = 'plan_choisi_le') then
    alter table organisations add column plan_choisi_le timestamptz;
    -- Comptes existants : leur plan est déjà en vigueur, rien ne leur est demandé.
    update organisations set plan_choisi_le = now();
  end if;
end $$;

create or replace function choisir_plan(p_plan text) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := app_org_id();
begin
  if v_org is null or app_role() <> 'proprietaire' then raise exception 'Seul le propriétaire peut choisir le plan.'; end if;
  if not exists (select 1 from plans where code = p_plan and (visible_public or code = (select plan_code from organisations where id = v_org))) then
    raise exception 'Ce plan n''est pas disponible.';
  end if;
  update organisations set plan_choisi_le = coalesce(plan_choisi_le, now()) where id = v_org;
  update abonnements set plan_en_attente = case when p_plan = plan_code then null else p_plan end where organisation_id = v_org;
  update factures_abonnement set statut = 'annulee', lien_paiement = null
   where organisation_id = v_org and type = 'abonnement' and statut = 'a_payer' and plan_code is distinct from p_plan;
  insert into journal_audit (auteur_id, action, cible, details)
  values (auth.uid(), 'plan_choisi', v_org::text, jsonb_build_object('plan', p_plan));
end $$;
