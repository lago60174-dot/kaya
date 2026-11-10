import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..", "..", "supabase");

// Imite ce que Supabase fournit : schéma auth, auth.uid() et les rôles.
const SHIM = `
create schema auth; create schema extensions;
create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text,
  created_at timestamptz, updated_at timestamptz);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, identity_data jsonb,
  provider text, provider_id text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function extensions.crypt(text, text) returns text language sql as $$ select 'hash:' || $1 $$;
create function extensions.gen_salt(text) returns text language sql as $$ select 'sel' $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
`;

export async function creerBase(avecSeed = false): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SHIM);
  const dossier = join(RACINE, "migrations");
  for (const f of readdirSync(dossier)
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(dossier, f), "utf8"));
  }
  if (avecSeed) await db.exec(readFileSync(join(RACINE, "seed.sql"), "utf8"));
  return db;
}

/** Exécute fn en tant qu'utilisateur connecté (userId) ou anonyme (null). */
export async function en<T>(
  db: PGlite,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId ?? "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

export async function lignes<T = Record<string, unknown>>(
  db: PGlite,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return en(db, userId, async () => (await db.query<T>(sql, params)).rows);
}

type Ids = Record<string, string>;
export const U = {
  patronA: "a0000000-0000-4000-8000-000000000001",
  vendeurA: "a0000000-0000-4000-8000-000000000002",
  patronB: "b0000000-0000-4000-8000-000000000001",
};

/** Deux organisations. A : patron, vendeur, 2 boutiques (le vendeur n'a accès qu'à la 1re), produits. */
export async function preparer(db: PGlite) {
  for (const id of Object.values(U)) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [
      id,
      `${id}@test.dev`,
    ]);
  }
  const a = (
    await lignes<{ r: Ids }>(
      db,
      U.patronA,
      "select creer_organisation('Org A', 'Boutique A') as r",
    )
  )[0].r;
  const b = (
    await lignes<{ r: Ids }>(
      db,
      U.patronB,
      "select creer_organisation('Org B', 'Boutique B') as r",
    )
  )[0].r;
  const boutique2 = (
    await db.query<{ id: string }>(
      "insert into boutiques (organisation_id, nom) values ($1, 'Boutique A2') returning id",
      [a.organisation_id],
    )
  ).rows[0].id;
  await db.query(
    "insert into parametres_boutique (boutique_id, organisation_id) values ($1, $2)",
    [boutique2, a.organisation_id],
  );
  await db.query(
    "insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees) values ($1, $2, 'vendeur', $3)",
    [U.vendeurA, a.organisation_id, [a.boutique_id]],
  );

  const produit = async (
    nom: string,
    base: string,
    achat: number,
    seuil: number,
    unites: [string, number, number][],
  ) => {
    const p = (
      await db.query<{ id: string }>(
        "insert into produits (organisation_id, nom, unite_base, seuil_alerte) values ($1, $2, $3, $4) returning id",
        [a.organisation_id, nom, base, seuil],
      )
    ).rows[0].id;
    await db.query(
      "insert into produit_couts (produit_id, organisation_id, prix_achat) values ($1, $2, $3)",
      [p, a.organisation_id, achat],
    );
    const us: Record<string, string> = {};
    for (const [n, f, prix] of unites) {
      us[n] = (
        await db.query<{ id: string }>(
          "insert into produit_unites (organisation_id, produit_id, nom, facteur, prix_vente) values ($1, $2, $3, $4, $5) returning id",
          [a.organisation_id, p, n, f, prix],
        )
      ).rows[0].id;
    }
    return { id: p, unites: us };
  };
  const ciment = await produit("Ciment 50 kg", "kg", 95, 100, [
    ["sac", 50, 5500],
    ["kg", 1, 130],
  ]);
  const clous = await produit("Clous 3 pouces", "kg", 900, 0, [
    ["kg", 1, 1200],
  ]);
  await en(db, U.patronA, () =>
    db.query("select enregistrer_mouvement_stock($1, $2, 'entree', 5, $3)", [
      a.boutique_id,
      ciment.id,
      ciment.unites.sac,
    ]),
  );
  await en(db, U.patronA, () =>
    db.query("select enregistrer_mouvement_stock($1, $2, 'entree', 10)", [
      a.boutique_id,
      clous.id,
    ]),
  );
  const client = (
    await db.query<{ id: string }>(
      "insert into clients (organisation_id, nom, telephone) values ($1, 'Jean Mbarga', '699000000') returning id",
      [a.organisation_id],
    )
  ).rows[0].id;
  return {
    orgA: a.organisation_id,
    boutiqueA: a.boutique_id,
    boutiqueA2: boutique2,
    orgB: b.organisation_id,
    boutiqueB: b.boutique_id,
    ciment,
    clous,
    client,
  };
}

export const cle = () => crypto.randomUUID();
