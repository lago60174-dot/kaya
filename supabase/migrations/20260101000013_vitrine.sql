-- Vitrine publique : chiffres du programme partenaire affichables à tous, et demandes « Devenir partenaire ».

-- Valeurs de parametres_plateforme destinées au public (jamais les réglages internes : délai de grâce...).
create function programme_partenaire_public() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'commission_pourcentage', commission_pourcentage,
    'duree_mois', commission_duree_mois,
    'seuil_versement', seuil_versement,
    'retention_jours', retention_jours,
    'essai_jours', essai_jours
  ) from parametres_plateforme
$$;
revoke execute on function programme_partenaire_public() from public, anon, authenticated;
grant execute on function programme_partenaire_public() to anon, authenticated;

-- Demande d'un futur partenaire. L'administrateur la valide à la main avant toute activation (étape 20).
create table demandes_partenaire (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 2 and 80),
  telephone text not null check (telephone ~ '^\+237[26][0-9]{8}$'),
  mode_versement text not null check (mode_versement in ('mtn', 'orange')),
  statut text not null default 'a_valider' check (statut in ('a_valider', 'acceptee', 'refusee')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
-- Une seule demande en attente par numéro : renvoyer le formulaire ne crée pas de doublon.
create unique index on demandes_partenaire (telephone) where statut = 'a_valider';

alter table demandes_partenaire enable row level security;
revoke all on demandes_partenaire from anon, authenticated;
grant select on demandes_partenaire to authenticated;
create policy lecture on demandes_partenaire for select to authenticated using (app_est_admin());
create trigger trg_modifie_le before update on demandes_partenaire for each row execute function maj_modifie_le();
create trigger trg_pas_de_suppression before delete on demandes_partenaire for each row execute function interdire_suppression();

-- Seule porte d'écriture : appelée par le serveur (clé service_role) après la vérification anti-robot.
-- Renvoie vrai si la demande est nouvelle, faux si une demande en attente existe déjà pour ce numéro.
create function demander_partenariat(p_nom text, p_telephone text, p_mode text) returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into demandes_partenaire (nom, telephone, mode_versement)
  values (btrim(p_nom), p_telephone, p_mode)
  on conflict (telephone) where statut = 'a_valider' do nothing
  returning id into v_id;
  return v_id is not null;
end $$;
revoke execute on function demander_partenariat(text, text, text) from public, anon, authenticated;
grant execute on function demander_partenariat(text, text, text) to service_role;
