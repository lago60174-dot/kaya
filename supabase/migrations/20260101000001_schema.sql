-- Kaya : schéma initial. Argent = bigint (FCFA entiers). Quantités = numeric(12,3).

create function maj_modifie_le() returns trigger language plpgsql as $$
begin new.modifie_le := now(); return new; end $$;

create table organisations (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  devise text not null default 'XAF',
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table boutiques (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  nom text not null,
  adresse text,
  telephone text,
  mention_legale text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table membres (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null unique references auth.users(id),
  organisation_id uuid not null references organisations(id),
  role text not null check (role in ('proprietaire', 'vendeur')),
  boutiques_autorisees uuid[] not null default '{}',
  nom text,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table parametres_boutique (
  boutique_id uuid primary key references boutiques(id),
  organisation_id uuid not null references organisations(id),
  seuil_remise_vendeur numeric(5,2) not null default 5 check (seuil_remise_vendeur between 0 and 100),
  plafond_credit_defaut bigint not null default 100000 check (plafond_credit_defaut >= 0),
  stock_negatif_autorise boolean not null default false,
  ecart_caisse_tolere bigint not null default 500 check (ecart_caisse_tolere >= 0),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  nom text not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (organisation_id, nom)
);

create table produits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  categorie_id uuid references categories(id),
  nom text not null,
  photo_url text,
  unite_base text not null,
  seuil_alerte numeric(12,3) not null default 0 check (seuil_alerte >= 0),
  actif boolean not null default true,
  code_barres text,
  archive_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

-- Le prix d'achat vit dans une table à part : la RLS ne sait pas masquer une colonne,
-- et un vendeur ne doit jamais le voir.
create table produit_couts (
  produit_id uuid primary key references produits(id),
  organisation_id uuid not null references organisations(id),
  prix_achat bigint not null default 0 check (prix_achat >= 0),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table produit_unites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  produit_id uuid not null references produits(id),
  nom text not null,
  facteur numeric(12,3) not null check (facteur > 0),
  prix_vente bigint not null check (prix_vente >= 0),
  archive_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (produit_id, nom)
);

create table stock_courant (
  produit_id uuid not null references produits(id),
  boutique_id uuid not null references boutiques(id),
  organisation_id uuid not null references organisations(id),
  quantite numeric(12,3) not null default 0,
  modifie_le timestamptz not null default now(),
  primary key (produit_id, boutique_id)
);

create table mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  produit_id uuid not null references produits(id),
  type text not null check (type in ('entree', 'vente', 'retour', 'perte', 'inventaire', 'correction')),
  quantite numeric(12,3) not null check (quantite <> 0),
  reference text,
  motif text,
  auteur_id uuid,
  cree_le timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  nom text not null,
  telephone text,
  plafond_credit bigint check (plafond_credit >= 0),
  notes text,
  archive_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table ventes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  numero_recu text not null,
  jeton_public text not null unique,
  client_id uuid references clients(id),
  vendeur_id uuid not null,
  sous_total bigint not null check (sous_total >= 0),
  remise bigint not null default 0 check (remise >= 0),
  total bigint not null check (total >= 0),
  statut text not null default 'valide' check (statut in ('valide', 'annulee')),
  cle_idempotence uuid not null,
  date timestamptz not null default now(),
  cree_le timestamptz not null default now(),
  unique (boutique_id, numero_recu),
  unique (boutique_id, cle_idempotence)
);

create table vente_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  vente_id uuid not null references ventes(id),
  produit_id uuid not null references produits(id),
  unite_id uuid not null references produit_unites(id),
  nom_produit text not null,
  nom_unite text not null,
  quantite numeric(12,3) not null check (quantite > 0),
  facteur numeric(12,3) not null,
  prix_unitaire bigint not null,
  remise_ligne bigint not null default 0,
  total_ligne bigint not null,
  cree_le timestamptz not null default now()
);

-- Coût figé au moment de la vente (pour la marge) : propriétaire uniquement.
create table vente_lignes_couts (
  vente_ligne_id uuid primary key references vente_lignes(id),
  organisation_id uuid not null references organisations(id),
  cout_total bigint not null
);

create table creances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  client_id uuid not null references clients(id),
  vente_id uuid not null unique references ventes(id),
  montant_du bigint not null check (montant_du > 0),
  montant_paye bigint not null default 0 check (montant_paye >= 0),
  solde bigint generated always as (montant_du - montant_paye) stored,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'soldee', 'annulee')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (montant_paye <= montant_du)
);

create table paiements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  type text not null check (type in ('vente', 'remboursement_credit')),
  vente_id uuid not null references ventes(id),
  creance_id uuid references creances(id),
  client_id uuid references clients(id),
  mode text not null check (mode in ('especes', 'mtn_momo', 'orange_money')),
  montant bigint not null check (montant > 0),
  numero_recu text,
  auteur_id uuid,
  date timestamptz not null default now(),
  cree_le timestamptz not null default now(),
  check (type = 'vente' or creance_id is not null)
);

create table avoirs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  vente_id uuid not null unique references ventes(id),
  numero text not null,
  motif text not null check (length(trim(motif)) > 0),
  montant bigint not null,
  rembourse_especes bigint not null default 0,
  auteur_id uuid,
  date timestamptz not null default now(),
  cree_le timestamptz not null default now(),
  unique (boutique_id, numero)
);

create table depenses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  categorie text not null check (categorie in ('transport', 'electricite', 'salaire', 'autre')),
  montant bigint not null check (montant > 0),
  mode text not null default 'especes' check (mode in ('especes', 'mtn_momo', 'orange_money')),
  note text,
  auteur_id uuid,
  date timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

create table clotures_caisse (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  date date not null,
  especes_attendues bigint not null,
  especes_comptees bigint not null check (especes_comptees >= 0),
  ecart bigint not null,
  auteur_id uuid,
  validee_par uuid,
  validee_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (boutique_id, date)
);

create table compteurs_recus (
  boutique_id uuid not null references boutiques(id),
  annee int not null,
  type text not null check (type in ('recu', 'paiement', 'avoir')),
  organisation_id uuid not null references organisations(id),
  dernier int not null default 0,
  primary key (boutique_id, annee, type)
);

create table journal_activite (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references organisations(id),
  boutique_id uuid references boutiques(id),
  auteur_id uuid,
  action text not null,
  entite text,
  entite_id text,
  details jsonb not null default '{}',
  alerte boolean not null default false,
  cree_le timestamptz not null default now()
);

create index on ventes (boutique_id, date desc);
create index on vente_lignes (vente_id);
create index on paiements (boutique_id, date);
create index on creances (client_id) where statut = 'ouverte';
create index on mouvements_stock (produit_id, boutique_id);
create index on journal_activite (organisation_id, cree_le desc);
create index on produits (organisation_id, nom);
