-- Étape 8 : caisse et dépenses (section 9.6).
-- 1. Les dépenses passent par une fonction atomique (idempotence, journal, droits, lecture seule).
-- 2. La caisse ne peut pas être clôturée pour une date future ni de plus de 30 jours en arrière.
-- 3. Le Mobile Money d'une vente annulée apparaît en « remboursé » dans la caisse du jour de l'annulation.
-- 4. Une dépense ne se modifie jamais, sauf pour être annulée (propriétaire, motif obligatoire) ; elle reste visible.
-- 5. Plus de dépense (ni d'annulation de dépense) dans une journée déjà clôturée.

alter table depenses add column cle_idempotence uuid;
alter table depenses add column annulee_le timestamptz;
alter table depenses add column annulee_par uuid;
alter table depenses add column motif_annulation text;
create unique index depenses_cle_idempotence on depenses (boutique_id, cle_idempotence) where cle_idempotence is not null;
create index depenses_boutique_date on depenses (boutique_id, date desc);
create index clotures_boutique_date on clotures_caisse (boutique_id, date desc);

-- Une dépense enregistrée ne se modifie jamais, sauf pour être annulée avec un motif. Elle ne se supprime pas
-- (trigger trg_pas_de_suppression de la migration 2), même pour la clé service_role.
create function verifier_modification_depense() returns trigger language plpgsql as $$
begin
  if old.annulee_le is null and new.annulee_le is not null and new.motif_annulation is not null
     and (to_jsonb(new) - 'annulee_le' - 'annulee_par' - 'motif_annulation') = (to_jsonb(old) - 'annulee_le' - 'annulee_par' - 'motif_annulation') then
    return new;
  end if;
  raise exception 'Une dépense ne peut pas être modifiée. Annulez-la avec un motif.';
end $$;
create trigger trg_depense_modifiable before update on depenses for each row execute function verifier_modification_depense();

-- Plus d'écriture directe : tout passe par enregistrer_depense.
revoke insert on depenses from authenticated;
drop policy ecriture_ajout on depenses;
drop policy lecture_seule_ajout on depenses;

create function enregistrer_depense(
  p_boutique uuid, p_categorie text, p_montant bigint, p_mode text, p_note text, p_cle uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare m membres; v_id uuid; v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  m := exiger_acces(p_boutique);
  perform verifier_ecriture(m.organisation_id);
  if p_cle is null then raise exception 'Clé d''enregistrement manquante.'; end if;
  if p_categorie is null or p_categorie not in ('transport', 'electricite', 'salaire', 'autre') then
    raise exception 'Choisissez une catégorie de dépense.';
  end if;
  -- Un vendeur saisit ses dépenses simples ; les salaires relèvent du propriétaire.
  if p_categorie = 'salaire' and m.role <> 'proprietaire' then
    raise exception 'Seul le propriétaire peut enregistrer un salaire.';
  end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant doit être supérieur à zéro.'; end if;
  if p_montant > 100000000 then raise exception 'Ce montant est trop élevé. Vérifiez-le.'; end if;
  if p_mode is null or p_mode not in ('especes', 'mtn_momo', 'orange_money') then
    raise exception 'Choisissez un mode de paiement.';
  end if;
  if v_note is not null and length(v_note) > 200 then raise exception 'La note est trop longue (200 caractères maximum).'; end if;

  -- Verrou par clé : deux envois simultanés de la même dépense s'enchaînent au lieu de se doubler.
  perform pg_advisory_xact_lock(hashtextextended(p_boutique::text || p_cle::text, 0));
  select id into v_id from depenses where boutique_id = p_boutique and cle_idempotence = p_cle;
  if found then return jsonb_build_object('id', v_id, 'deja_enregistree', true); end if;

  if exists (select 1 from clotures_caisse where boutique_id = p_boutique and date = (now() at time zone 'Africa/Douala')::date) then
    raise exception 'La caisse du jour est déjà clôturée : cette dépense changerait des chiffres déjà validés. Saisissez-la demain.';
  end if;
  insert into depenses (organisation_id, boutique_id, categorie, montant, mode, note, auteur_id, cle_idempotence)
  values (m.organisation_id, p_boutique, p_categorie, p_montant, p_mode, v_note, auth.uid(), p_cle)
  returning id into v_id;
  perform ecrire_journal(m.organisation_id, p_boutique, 'depense_enregistree', 'depense', v_id::text,
    jsonb_build_object('categorie', p_categorie, 'montant', p_montant, 'mode', p_mode));
  return jsonb_build_object('id', v_id, 'deja_enregistree', false);
end $$;

revoke execute on function enregistrer_depense(uuid, text, bigint, text, text, uuid) from public, anon, authenticated;
grant execute on function enregistrer_depense(uuid, text, bigint, text, text, uuid) to authenticated;

-- Caisse du jour : mêmes clés qu'avant, plus le Mobile Money remboursé, le crédit accordé et le nombre de ventes.
create or replace function calculer_caisse(p_boutique uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres; v_ventes bigint; v_nb int; v_credit bigint; v_ev bigint; v_er bigint; v_momo bigint; v_om bigint;
  v_momo_r bigint; v_om_r bigint; v_de bigint; v_dt bigint; v_av bigint;
begin
  m := exiger_acces(p_boutique);
  select coalesce(sum(total), 0), count(*) into v_ventes, v_nb from ventes
    where boutique_id = p_boutique and statut = 'valide' and (date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(cr.montant_du), 0) into v_credit from creances cr join ventes v on v.id = cr.vente_id
    where cr.boutique_id = p_boutique and v.statut = 'valide' and (v.date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(montant) filter (where type = 'vente' and mode = 'especes'), 0),
         coalesce(sum(montant) filter (where type = 'remboursement_credit' and mode = 'especes'), 0),
         coalesce(sum(montant) filter (where mode = 'mtn_momo'), 0),
         coalesce(sum(montant) filter (where mode = 'orange_money'), 0)
    into v_ev, v_er, v_momo, v_om from paiements
    where boutique_id = p_boutique and (date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(p.montant) filter (where p.mode = 'mtn_momo'), 0), coalesce(sum(p.montant) filter (where p.mode = 'orange_money'), 0)
    into v_momo_r, v_om_r from paiements p join avoirs a on a.vente_id = p.vente_id
    where a.boutique_id = p_boutique and (a.date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(montant) filter (where mode = 'especes'), 0), coalesce(sum(montant), 0) into v_de, v_dt from depenses
    where boutique_id = p_boutique and annulee_le is null and (date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(rembourse_especes), 0) into v_av from avoirs
    where boutique_id = p_boutique and (date at time zone 'Africa/Douala')::date = p_date;
  return jsonb_build_object('ventes_total', v_ventes, 'nb_ventes', v_nb, 'credit_accorde', v_credit,
    'encaissements_especes', v_ev, 'remboursements_credit_especes', v_er,
    'mtn_momo', v_momo, 'orange_money', v_om, 'mtn_momo_rembourse', v_momo_r, 'orange_money_rembourse', v_om_r,
    'depenses_total', v_dt, 'depenses_especes', v_de,
    'avoirs_especes', v_av, 'especes_attendues', v_ev + v_er - v_de - v_av);
end $$;

-- Clôture : refuse une date future (la journée n'est pas finie, le compte serait faux) et une date de plus de 30 jours.
create or replace function cloturer_caisse(p_boutique uuid, p_date date, p_especes_comptees bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m membres; v_caisse jsonb; v_attendu bigint; v_ecart bigint; v_tol bigint; v_id uuid;
begin
  m := exiger_acces(p_boutique);
  perform verifier_ecriture(m.organisation_id);
  if p_date is null then raise exception 'Choisissez la date de la caisse.'; end if;
  if p_date > (now() at time zone 'Africa/Douala')::date then
    raise exception 'Cette journée n''a pas encore eu lieu : la caisse ne peut pas être clôturée.';
  end if;
  if p_date < (now() at time zone 'Africa/Douala')::date - 30 then
    raise exception 'Cette date est trop ancienne pour être clôturée.';
  end if;
  if p_especes_comptees is null or p_especes_comptees < 0 then raise exception 'Montant compté invalide.'; end if;
  if exists (select 1 from clotures_caisse where boutique_id = p_boutique and date = p_date) then
    raise exception 'La caisse de cette date est déjà clôturée.';
  end if;
  v_caisse := calculer_caisse(p_boutique, p_date);
  v_attendu := (v_caisse->>'especes_attendues')::bigint;
  v_ecart := p_especes_comptees - v_attendu;
  select ecart_caisse_tolere into v_tol from parametres_boutique where boutique_id = p_boutique;
  insert into clotures_caisse (organisation_id, boutique_id, date, especes_attendues, especes_comptees, ecart, auteur_id)
  values (m.organisation_id, p_boutique, p_date, v_attendu, p_especes_comptees, v_ecart, auth.uid()) returning id into v_id;
  perform ecrire_journal(m.organisation_id, p_boutique, 'caisse_cloturee', 'cloture', v_id::text,
    jsonb_build_object('attendu', v_attendu, 'compte', p_especes_comptees, 'ecart', v_ecart, 'date', p_date), abs(v_ecart) > v_tol);
  return jsonb_build_object('cloture_id', v_id, 'especes_attendues', v_attendu, 'ecart', v_ecart);
end $$;

-- Annulation d'une dépense saisie par erreur : propriétaire seulement, motif obligatoire, impossible une fois la journée clôturée.
-- La dépense reste visible (barrée) et ne compte plus dans la caisse.
create function annuler_depense(p_boutique uuid, p_depense uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
declare m membres; d depenses;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut annuler une dépense.'; end if;
  perform verifier_ecriture(m.organisation_id);
  if length(trim(coalesce(p_motif, ''))) = 0 then raise exception 'Un motif est obligatoire pour annuler une dépense.'; end if;
  if length(trim(p_motif)) > 200 then raise exception 'Ce motif est trop long (200 caractères maximum).'; end if;
  select * into d from depenses where id = p_depense and boutique_id = p_boutique for update;
  if not found then raise exception 'Dépense introuvable.'; end if;
  if d.annulee_le is not null then raise exception 'Cette dépense est déjà annulée.'; end if;
  if exists (select 1 from clotures_caisse where boutique_id = p_boutique and date = (d.date at time zone 'Africa/Douala')::date) then
    raise exception 'La caisse de ce jour est déjà clôturée : cette dépense ne peut plus être annulée.';
  end if;
  update depenses set annulee_le = now(), annulee_par = auth.uid(), motif_annulation = trim(p_motif) where id = p_depense;
  perform ecrire_journal(m.organisation_id, p_boutique, 'depense_annulee', 'depense', p_depense::text,
    jsonb_build_object('montant', d.montant, 'categorie', d.categorie, 'motif', trim(p_motif)), true);
end $$;

revoke execute on function verifier_modification_depense(), annuler_depense(uuid, uuid, text) from public, anon, authenticated;
grant execute on function annuler_depense(uuid, uuid, text) to authenticated;
