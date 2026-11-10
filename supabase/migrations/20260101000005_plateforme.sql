-- Plans, abonnements, affiliation, rôles de plateforme, limites et lecture seule.

alter table produits rename column photo_url to image_cle;
alter table produits add column vignette_cle text;
alter table organisations add column ville text, add column telephone text;

create table plans (
  code text primary key check (code in ('essentiel', 'pro', 'business')),
  nom text not null,
  prix_mensuel bigint not null check (prix_mensuel >= 0),
  fonctionnalites jsonb not null default '{}',
  limites jsonb not null default '{}',
  visible_public boolean not null default false,
  ordre int not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- Limites : un nombre, ou null = illimité. Une clé absente vaut 0.
insert into plans (code, nom, prix_mensuel, fonctionnalites, limites, visible_public, ordre) values
  ('essentiel', 'Essentiel', 5000,
   '{"journal_complet":false,"devis":false,"fournisseurs":false,"impression":false,"multi_boutiques":false,"resume_whatsapp":false}',
   '{"vendeurs":1,"boutiques":1}', true, 1),
  ('pro', 'Pro', 10000,
   '{"journal_complet":true,"devis":true,"fournisseurs":true,"impression":true,"multi_boutiques":false,"resume_whatsapp":true}',
   '{"vendeurs":3,"boutiques":1}', false, 2),
  ('business', 'Business', 15000,
   '{"journal_complet":true,"devis":true,"fournisseurs":true,"impression":true,"multi_boutiques":true,"resume_whatsapp":true}',
   '{"vendeurs":null,"boutiques":null}', false, 3);

alter table organisations add column plan_code text not null default 'essentiel' references plans(code);

create table parametres_plateforme (
  id int primary key default 1 check (id = 1),
  commission_pourcentage numeric(5,2) not null default 20,
  commission_duree_mois int not null default 6,
  seuil_versement bigint not null default 5000,
  retention_jours int not null default 14,
  essai_jours int not null default 14 check (essai_jours >= 0),
  grace_jours int not null default 5,
  modifie_le timestamptz not null default now()
);
insert into parametres_plateforme default values;

create table abonnements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references organisations(id),
  plan_code text not null references plans(code),
  plan_en_attente text references plans(code),
  statut text not null default 'essai' check (statut in ('essai', 'actif', 'en_retard', 'suspendu', 'annule')),
  periode text not null default 'mensuelle' check (periode in ('mensuelle', 'annuelle')),
  debut timestamptz not null default now(),
  prochaine_echeance timestamptz,
  fin_essai timestamptz,
  fin_grace timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table factures_abonnement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  abonnement_id uuid not null references abonnements(id),
  type text not null check (type in ('abonnement', 'installation')),
  montant_brut bigint not null check (montant_brut >= 0),
  frais_paiement bigint not null default 0 check (frais_paiement >= 0),
  montant_net bigint generated always as (montant_brut - frais_paiement) stored,
  echeance timestamptz,
  statut text not null default 'a_payer' check (statut in ('a_payer', 'payee', 'annulee')),
  external_id text unique,
  mode text not null check (mode in ('fapshi', 'manuel')),
  note text,
  payee_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table evenements_paiement (
  id uuid primary key default gen_random_uuid(),
  fournisseur text not null default 'fapshi',
  evenement_id text not null,
  contenu jsonb not null,
  statut_traitement text not null default 'recu' check (statut_traitement in ('recu', 'traite', 'ignore', 'erreur')),
  cree_le timestamptz not null default now(),
  unique (fournisseur, evenement_id)
);

create table envois_whatsapp (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  destinataire text not null,
  type text not null check (type in ('resume_quotidien', 'relance')),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'envoye', 'echec')),
  erreur text,
  cree_le timestamptz not null default now()
);

-- Rôles de plateforme : hors organisations.
create table administrateurs_plateforme (
  utilisateur_id uuid primary key references auth.users(id),
  cree_le timestamptz not null default now()
);

create table affilies (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null unique references auth.users(id),
  nom text not null,
  email text,
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  telephone text,
  mode_versement text not null default 'mtn' check (mode_versement in ('mtn', 'orange')),
  actif boolean not null default false,
  valide_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table parrainages (
  id uuid primary key default gen_random_uuid(),
  affilie_id uuid not null references affilies(id),
  organisation_id uuid not null unique references organisations(id),
  source text not null default 'lien' check (source in ('lien', 'code')),
  statut text not null default 'inscrit' check (statut in ('inscrit', 'abonne', 'annule')),
  cree_le timestamptz not null default now()
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  affilie_id uuid not null references affilies(id),
  parrainage_id uuid not null references parrainages(id),
  facture_id uuid not null unique references factures_abonnement(id), -- jamais deux commissions pour une facture
  montant bigint not null check (montant >= 0),
  pourcentage numeric(5,2) not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'a_payer', 'payee', 'annulee')),
  disponible_le timestamptz not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table versements_affilies (
  id uuid primary key default gen_random_uuid(),
  affilie_id uuid not null references affilies(id),
  montant bigint not null check (montant > 0),
  mode text not null check (mode in ('mtn', 'orange')),
  reference text not null,
  auteur_id uuid,
  date timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

create table journal_audit (
  id bigint generated always as identity primary key,
  auteur_id uuid,
  action text not null,
  cible text,
  details jsonb not null default '{}',
  cree_le timestamptz not null default now()
);

create index on factures_abonnement (organisation_id, echeance);
create index on parrainages (affilie_id);
create index on commissions (affilie_id, statut);

do $$
declare t text;
begin
  foreach t in array array['plans', 'abonnements', 'factures_abonnement', 'affilies', 'commissions', 'parametres_plateforme'] loop
    execute format('create trigger trg_modifie_le before update on %I for each row execute function maj_modifie_le()', t);
  end loop;
  foreach t in array array['abonnements', 'factures_abonnement', 'affilies', 'parrainages', 'commissions', 'versements_affilies', 'plans'] loop
    execute format('create trigger trg_pas_de_suppression before delete on %I for each row execute function interdire_suppression()', t);
  end loop;
  foreach t in array array['journal_audit', 'versements_affilies'] loop
    execute format('create trigger trg_immuable before update or delete on %I for each row execute function interdire_modification()', t);
  end loop;
end $$;

-- Aides : rôles de plateforme, plan, lecture seule.
create function app_est_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from administrateurs_plateforme where utilisateur_id = auth.uid())
$$;

create function app_affilie_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from affilies where utilisateur_id = auth.uid() and actif
$$;

create function app_ecriture_ok() returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from abonnements a where a.organisation_id = app_org_id() and a.statut in ('suspendu', 'annule'))
$$;

create function verifier_ecriture(p_org uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from abonnements where organisation_id = p_org and statut in ('suspendu', 'annule')) then
    raise exception 'Votre abonnement est suspendu : l''application est en lecture seule. Réglez votre abonnement pour reprendre.';
  end if;
end $$;

-- Versions internes (sans contrôle de l'appelant) : pour les triggers et fonctions SQL.
create function plan_permet(p_org uuid, p_fonction text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (p.fonctionnalites ->> p_fonction)::boolean
                   from plans p join organisations o on o.plan_code = p.code where o.id = p_org), false)
$$;

-- null = illimité ; plan ou clé introuvable = 0.
create function plan_limite(p_org uuid, p_cle text) returns integer language plpgsql stable security definer set search_path = public as $$
declare v_lim jsonb;
begin
  select p.limites into v_lim from plans p join organisations o on o.plan_code = p.code where o.id = p_org;
  if not found or not (v_lim ? p_cle) then return 0; end if;
  if jsonb_typeof(v_lim -> p_cle) = 'null' then return null; end if;
  return (v_lim ->> p_cle)::int;
end $$;

-- Versions publiques : un utilisateur ne peut interroger que son organisation.
create function peut_utiliser(p_org uuid, p_fonction text) returns boolean language sql stable security definer set search_path = public as $$
  select case when p_org = app_org_id() or app_est_admin() then plan_permet(p_org, p_fonction) else false end
$$;

create function limite_plan(p_org uuid, p_cle text) returns integer language sql stable security definer set search_path = public as $$
  select case when p_org = app_org_id() or app_est_admin() then plan_limite(p_org, p_cle) else 0 end
$$;

-- Limites contrôlées en base : même la clé service_role ne les contourne pas.
create function verifier_limite_vendeurs() returns trigger language plpgsql as $$
declare v_max int; v_n int; v_s text;
begin
  if new.role <> 'vendeur' or not new.actif then return new; end if;
  if tg_op = 'UPDATE' and old.actif and old.role = 'vendeur' then return new; end if;
  v_max := plan_limite(new.organisation_id, 'vendeurs');
  if v_max is null then return new; end if;
  select count(*) into v_n from membres
    where organisation_id = new.organisation_id and role = 'vendeur' and actif and id is distinct from new.id;
  if v_n >= v_max then
    v_s := case when v_max > 1 then 's' else '' end;
    raise exception 'Votre abonnement permet % vendeur% actif%. Désactivez un vendeur pour en ajouter un autre.', v_max, v_s, v_s;
  end if;
  return new;
end $$;
create trigger trg_limite_vendeurs before insert or update on membres for each row execute function verifier_limite_vendeurs();

create function verifier_limite_boutiques() returns trigger language plpgsql as $$
declare v_max int; v_n int; v_s text;
begin
  v_max := plan_limite(new.organisation_id, 'boutiques');
  if v_max is null then return new; end if;
  select count(*) into v_n from boutiques where organisation_id = new.organisation_id;
  if v_n >= v_max then
    v_s := case when v_max > 1 then 's' else '' end;
    raise exception 'Votre abonnement permet % boutique%.', v_max, v_s;
  end if;
  return new;
end $$;
create trigger trg_limite_boutiques before insert on boutiques for each row execute function verifier_limite_boutiques();

-- Inscription : organisation, première boutique, abonnement d'essai, parrainage éventuel.
create function creer_organisation(
  p_nom text, p_nom_boutique text, p_ville text default null, p_telephone text default null,
  p_code_parrainage text default null, p_source text default 'lien'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_boutique uuid; v_essai int; v_aff affilies;
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
  select essai_jours into v_essai from parametres_plateforme;
  insert into abonnements (organisation_id, plan_code, statut, fin_essai, prochaine_echeance)
  values (v_org, 'essentiel', 'essai', now() + make_interval(days => v_essai), now() + make_interval(days => v_essai));

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

-- RLS
do $$
declare t text;
begin
  foreach t in array array['plans', 'parametres_plateforme', 'abonnements', 'factures_abonnement', 'evenements_paiement', 'envois_whatsapp',
    'administrateurs_plateforme', 'affilies', 'parrainages', 'commissions', 'versements_affilies', 'journal_audit'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;
grant select on plans to anon;

-- Un plan masqué n'apparaît dans aucune API publique ; une organisation voit son propre plan.
create policy lecture_publique on plans for select to anon using (visible_public);
create policy lecture on plans for select to authenticated
  using (visible_public or app_est_admin() or code = (select plan_code from organisations where id = app_org_id()));
create policy lecture on abonnements for select to authenticated
  using (app_est_admin() or (organisation_id = app_org_id() and app_role() = 'proprietaire'));
create policy lecture on factures_abonnement for select to authenticated
  using (app_est_admin() or (organisation_id = app_org_id() and app_role() = 'proprietaire'));
create policy lecture on administrateurs_plateforme for select to authenticated using (utilisateur_id = auth.uid());
create policy lecture on affilies for select to authenticated using (utilisateur_id = auth.uid() or app_est_admin());
create policy lecture on parrainages for select to authenticated
  using (app_est_admin() or affilie_id = app_affilie_id());
create policy lecture on commissions for select to authenticated
  using (app_est_admin() or affilie_id = app_affilie_id());
create policy lecture on versements_affilies for select to authenticated
  using (app_est_admin() or affilie_id = app_affilie_id());
do $$
declare t text;
begin
  foreach t in array array['parametres_plateforme', 'evenements_paiement', 'envois_whatsapp', 'journal_audit'] loop
    execute format('create policy lecture on %I for select to authenticated using (app_est_admin())', t);
  end loop;
end $$;

-- Journal : de base (ventes, annulations, remises, clôtures) ou complet selon le plan.
drop policy lecture on journal_activite;
create policy lecture on journal_activite for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire'
         and (peut_utiliser(organisation_id, 'journal_complet')
              or action in ('vente_creee', 'vente_annulee', 'remise_elevee', 'caisse_cloturee', 'caisse_validee')));

-- Compte suspendu ou annulé : lecture seule, y compris pour les écritures directes.
do $$
declare t text;
begin
  foreach t in array array['categories', 'produits', 'produit_unites', 'produit_couts', 'clients', 'depenses'] loop
    execute format('create policy lecture_seule_ajout on %I as restrictive for insert to authenticated with check (app_ecriture_ok())', t);
  end loop;
  foreach t in array array['categories', 'produits', 'produit_unites', 'produit_couts', 'clients', 'parametres_boutique', 'boutiques'] loop
    execute format('create policy lecture_seule_modif on %I as restrictive for update to authenticated using (app_ecriture_ok()) with check (app_ecriture_ok())', t);
  end loop;
end $$;

-- Fonctions : fermées par défaut, ouvertes aux utilisateurs connectés seulement quand c'est voulu.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function app_org_id(), app_role(), app_acces_boutique(uuid), app_est_admin(), app_affilie_id(), app_ecriture_ok(),
  peut_utiliser(uuid, text), limite_plan(uuid, text),
  creer_organisation(text, text, text, text, text, text),
  creer_vente(uuid, uuid, jsonb, jsonb, uuid, bigint, boolean),
  annuler_vente(uuid, text),
  enregistrer_remboursement(uuid, bigint, text),
  enregistrer_mouvement_stock(uuid, uuid, text, numeric, uuid, text, bigint),
  calculer_caisse(uuid, date), cloturer_caisse(uuid, date, bigint), valider_cloture(uuid)
to authenticated;
