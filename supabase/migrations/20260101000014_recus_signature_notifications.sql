-- 14 : reçus plus crédibles (identité légale, signature, cachet), notifications, abonnement sans essai.

-- 1. Abonnement : pas d'essai gratuit, 3 jours de grâce (réglables depuis parametres_plateforme).
update parametres_plateforme set essai_jours = 0, grace_jours = 3;
alter table parametres_plateforme alter column essai_jours set default 0;
alter table parametres_plateforme alter column grace_jours set default 3;

-- 2. Identité de la boutique, signature et cachet (PNG dans R2, jamais en base).
alter table boutiques
  add column ville text,
  add column email text,
  add column rccm text,
  add column niu text,
  add column signataire text,
  add column signature_cle text check (signature_cle is null or signature_cle ~ '^[0-9a-f-]{36}/[0-9a-f]{64}-s\.png$'),
  add column cachet_cle text check (cachet_cle is null or cachet_cle ~ '^[0-9a-f-]{36}/[0-9a-f]{64}-c\.png$');

create function modifier_identite_boutique(
  p_boutique uuid, p_ville text, p_email text, p_rccm text, p_niu text, p_signataire text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres;
  v_ville text := nullif(trim(coalesce(p_ville, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_rccm text := nullif(trim(coalesce(p_rccm, '')), '');
  v_niu text := nullif(trim(coalesce(p_niu, '')), '');
  v_sign text := nullif(trim(coalesce(p_signataire, '')), '');
  b boutiques;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut modifier ces informations.'; end if;
  perform verifier_ecriture(m.organisation_id);
  if char_length(v_ville) > 60 then raise exception 'La ville est trop longue.'; end if;
  if v_email is not null and (char_length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'L''adresse email est invalide.'; end if;
  if char_length(v_rccm) > 40 then raise exception 'Le numéro RCCM est trop long.'; end if;
  if char_length(v_niu) > 40 then raise exception 'Le numéro de contribuable est trop long.'; end if;
  if char_length(v_sign) > 80 then raise exception 'Le nom du signataire est trop long.'; end if;
  select * into b from boutiques where id = p_boutique for update;
  if b.ville is not distinct from v_ville and b.email is not distinct from v_email and b.rccm is not distinct from v_rccm
     and b.niu is not distinct from v_niu and b.signataire is not distinct from v_sign then
    return jsonb_build_object('modifie', false);
  end if;
  update boutiques set ville = v_ville, email = v_email, rccm = v_rccm, niu = v_niu, signataire = v_sign where id = p_boutique;
  perform ecrire_journal(m.organisation_id, p_boutique, 'parametres_modifies', 'boutique', p_boutique::text,
    jsonb_build_object('champs', jsonb_build_array('identite_legale'), 'avant', '{}'::jsonb, 'apres', '{}'::jsonb));
  return jsonb_build_object('modifie', true);
end $$;
revoke execute on function modifier_identite_boutique(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function modifier_identite_boutique(uuid, text, text, text, text, text) to authenticated;

-- Signature et cachet : même garde-fous que le logo (propriétaire, écriture permise, clé de sa propre organisation).
create function definir_image_boutique(p_boutique uuid, p_type text, p_cle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m membres; b boutiques; v_motif text; v_actuel text;
begin
  if p_type not in ('signature', 'cachet') then raise exception 'Type d''image invalide.'; end if;
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut modifier la signature et le cachet.'; end if;
  perform verifier_ecriture(m.organisation_id);
  v_motif := case p_type when 'signature' then '^[0-9a-f-]{36}/[0-9a-f]{64}-s\.png$' else '^[0-9a-f-]{36}/[0-9a-f]{64}-c\.png$' end;
  if p_cle is not null and (p_cle !~ v_motif or split_part(p_cle, '/', 1) <> m.organisation_id::text) then
    raise exception 'Image invalide. Choisissez-en une autre.';
  end if;
  select * into b from boutiques where id = p_boutique for update;
  v_actuel := case p_type when 'signature' then b.signature_cle else b.cachet_cle end;
  if v_actuel is not distinct from p_cle then return jsonb_build_object('modifie', false); end if;
  if p_type = 'signature' then update boutiques set signature_cle = p_cle where id = p_boutique;
  else update boutiques set cachet_cle = p_cle where id = p_boutique; end if;
  perform ecrire_journal(m.organisation_id, p_boutique, 'parametres_modifies', 'boutique', p_boutique::text,
    jsonb_build_object('champs', jsonb_build_array(p_type), 'avant', '{}'::jsonb, 'apres', '{}'::jsonb));
  return jsonb_build_object('modifie', true);
end $$;
revoke execute on function definir_image_boutique(uuid, text, text) from public, anon, authenticated;
grant execute on function definir_image_boutique(uuid, text, text) to authenticated;

-- Page publique du reçu : identité complète de la boutique et nom du vendeur (utile en cas de litige).
-- Rien de sensible : tout cela figure déjà sur le reçu papier. Aucune marge, aucun prix d'achat.
create or replace function recu_public(p_jeton text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v ventes; b boutiques;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into v from ventes where jeton_public = p_jeton;
  if not found then return null; end if;
  select * into b from boutiques where id = v.boutique_id;
  return jsonb_build_object(
    'numero_recu', v.numero_recu, 'date', v.date, 'annule', v.statut = 'annulee', 'remise', v.remise, 'total', v.total,
    'boutique', jsonb_build_object('nom', b.nom, 'adresse', b.adresse, 'telephone', b.telephone, 'mention_legale', b.mention_legale,
      'logo_cle', b.logo_cle, 'ville', b.ville, 'email', b.email, 'rccm', b.rccm, 'niu', b.niu, 'signataire', b.signataire,
      'signature_cle', b.signature_cle, 'cachet_cle', b.cachet_cle),
    'vendeur', (select nom from membres where utilisateur_id = v.vendeur_id limit 1),
    'client_nom', (select nom from clients where id = v.client_id),
    'lignes', (select coalesce(jsonb_agg(jsonb_build_object('nom', l.nom_produit, 'unite', l.nom_unite, 'quantite', l.quantite,
                 'prix_unitaire', l.prix_unitaire, 'remise_ligne', l.remise_ligne, 'total', l.total_ligne) order by l.ordre, l.id), '[]')
                 from vente_lignes l where l.vente_id = v.id),
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object('mode', p.mode, 'montant', p.montant) order by p.date, p.id), '[]')
                    from paiements p where p.vente_id = v.id and p.type = 'vente'),
    'credit', (select coalesce(sum(cr.solde), 0) from creances cr where cr.vente_id = v.id and cr.statut = 'ouverte')
  );
end $$;

-- 3. Notifications : chaque alerte du journal devient une notification pour le propriétaire.
create table notifications (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references organisations(id),
  boutique_id uuid references boutiques(id),
  type text not null,
  titre text not null,
  corps text,
  lien text,
  critique boolean not null default false,
  journal_id bigint,
  cree_le timestamptz not null default now(),
  lue_le timestamptz,
  push_envoye_le timestamptz
);
create index on notifications (organisation_id, cree_le desc);
create index on notifications (organisation_id) where lue_le is null;
create index on notifications (organisation_id) where push_envoye_le is null;

-- Canaux choisis par le propriétaire, par type d'alerte : { "stock_bas": { "app": true, "push": true, "resume": false } }.
create table preferences_notifications (
  organisation_id uuid primary key references organisations(id),
  canaux jsonb not null default '{}',
  modifie_le timestamptz not null default now()
);

create table abonnements_push (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  cree_le timestamptz not null default now()
);
create index on abonnements_push (organisation_id);

create function journal_vers_notification() returns trigger language plpgsql security definer set search_path = public as $$
declare v_titre text; v_corps text; v_lien text := '/journal?alertes=1'; v_critique boolean := false; v_nom text;
begin
  if not new.alerte then return new; end if;
  case new.action
    when 'stock_bas' then
      v_titre := 'Stock bas'; v_lien := '/stock?bas=1';
      v_nom := coalesce(new.details ->> 'produit', new.details ->> 'nom');
      v_corps := case when v_nom is not null then v_nom || ' passe sous son seuil d''alerte.' else 'Un produit passe sous son seuil d''alerte.' end;
    when 'stock_negatif' then
      v_titre := 'Stock négatif'; v_critique := true; v_lien := '/stock';
      v_corps := 'Une vente a été faite sans stock suffisant. Vérifiez votre inventaire.';
    when 'remise_elevee' then
      v_titre := 'Remise élevée'; v_corps := 'Un vendeur a accordé une remise importante.';
    when 'vente_annulee' then
      v_titre := 'Vente annulée'; v_critique := true; v_corps := 'Une vente vient d''être annulée.'; v_lien := '/recus';
    when 'credit_force' then
      v_titre := 'Crédit au-delà du plafond'; v_critique := true; v_corps := 'Un crédit a été accordé au-delà du plafond du client.'; v_lien := '/clients/dettes';
    when 'caisse_cloturee' then
      v_titre := 'Écart de caisse'; v_critique := true; v_corps := 'La clôture de caisse présente un écart au-delà du seuil toléré.'; v_lien := '/caisse';
    else
      v_titre := 'Alerte'; v_corps := 'Une alerte a été enregistrée dans le journal.';
  end case;
  insert into notifications (organisation_id, boutique_id, type, titre, corps, lien, critique, journal_id)
  values (new.organisation_id, new.boutique_id, new.action, v_titre, v_corps, v_lien, v_critique, new.id);
  return new;
end $$;
create trigger journal_notifie after insert on journal_activite for each row execute function journal_vers_notification();

alter table notifications enable row level security;
alter table preferences_notifications enable row level security;
alter table abonnements_push enable row level security;

-- Propriétaire seulement : un vendeur ne voit ni alertes ni réglages.
create policy lecture on notifications for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire');
create policy lecture on preferences_notifications for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire');
create policy lecture on abonnements_push for select to authenticated
  using (utilisateur_id = auth.uid());
grant select on notifications, preferences_notifications, abonnements_push to authenticated;

create function marquer_notifications_lues(p_ids bigint[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare m membres; n integer;
begin
  select * into m from membres where utilisateur_id = auth.uid() and actif;
  if not found or m.role <> 'proprietaire' then raise exception 'Accès refusé.'; end if;
  update notifications set lue_le = now()
   where organisation_id = m.organisation_id and lue_le is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function marquer_notifications_lues(bigint[]) from public, anon, authenticated;
grant execute on function marquer_notifications_lues(bigint[]) to authenticated;

create function enregistrer_preferences_notifications(p_canaux jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m membres;
begin
  select * into m from membres where utilisateur_id = auth.uid() and actif;
  if not found or m.role <> 'proprietaire' then raise exception 'Accès refusé.'; end if;
  if jsonb_typeof(p_canaux) <> 'object' then raise exception 'Réglages invalides.'; end if;
  insert into preferences_notifications (organisation_id, canaux) values (m.organisation_id, p_canaux)
  on conflict (organisation_id) do update set canaux = excluded.canaux, modifie_le = now();
end $$;
revoke execute on function enregistrer_preferences_notifications(jsonb) from public, anon, authenticated;
grant execute on function enregistrer_preferences_notifications(jsonb) to authenticated;

-- 4. Chiffres publics pour la landing : uniquement des totaux réels, aucune donnée de boutique identifiable.
-- Les comptes de démonstration et de test (hors_statistiques = true) ne comptent jamais : seuls de vrais chiffres s'affichent.
alter table organisations add column hors_statistiques boolean not null default false;

create function chiffres_publics() returns jsonb language sql stable security definer set search_path = public as $$
  with reelles as (select id from organisations where not hors_statistiques)
  select jsonb_build_object(
    'boutiques', (select count(*) from boutiques b join reelles r on r.id = b.organisation_id),
    'ventes', (select count(*) from ventes v join reelles r on r.id = v.organisation_id where v.statut = 'valide'),
    'montant_ventes', (select coalesce(sum(v.total), 0) from ventes v join reelles r on r.id = v.organisation_id where v.statut = 'valide'),
    'produits', (select count(*) from produits p join reelles r on r.id = p.organisation_id where p.archive_le is null),
    'credits_recouvres', (select coalesce(sum(p.montant), 0) from paiements p join reelles r on r.id = p.organisation_id where p.type = 'remboursement_credit')
  )
$$;
revoke execute on function chiffres_publics() from public;
grant execute on function chiffres_publics() to anon, authenticated;
