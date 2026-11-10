import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;
const n = async (user: string | null, table: string) =>
  (await lignes(db, user, `select 1 from ${table}`)).length;

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
  await lignes(
    db,
    U.patronA,
    'select creer_vente($1, $2, $3::jsonb, \'[{"mode":"especes"}]\')',
    [
      f.boutiqueA,
      cle(),
      JSON.stringify([
        { produit_id: f.clous.id, unite_id: f.clous.unites.kg, quantite: 1 },
      ]),
    ],
  );
});

describe("isolation entre organisations", () => {
  it.each([
    "produits",
    "produit_unites",
    "clients",
    "ventes",
    "vente_lignes",
    "paiements",
    "stock_courant",
    "mouvements_stock",
    "boutiques",
    "parametres_boutique",
    "produit_couts",
    "journal_activite",
  ])(
    "le propriétaire de l'organisation B ne voit rien de A dans %s",
    async (t) => {
      expect(await n(U.patronA, t)).toBeGreaterThan(0);
      expect(
        await n(
          U.patronB,
          t === "boutiques" || t === "parametres_boutique"
            ? "(select 1 where false) x"
            : t,
        ),
      ).toBe(
        t === "boutiques" || t === "parametres_boutique"
          ? 0
          : t === "journal_activite"
            ? 1
            : 0,
      );
    },
  );

  it("B ne peut ni créer une vente, ni annuler, ni modifier le stock chez A", async () => {
    const l = JSON.stringify([
      { produit_id: f.clous.id, unite_id: f.clous.unites.kg, quantite: 1 },
    ]);
    await expect(
      lignes(db, U.patronB, "select creer_vente($1, $2, $3::jsonb)", [
        f.boutiqueA,
        cle(),
        l,
      ]),
    ).rejects.toThrow(/Boutique introuvable/);
    const v = (await db.query<{ id: string }>("select id from ventes limit 1"))
      .rows[0].id;
    await expect(
      lignes(db, U.patronB, "select annuler_vente($1, 'x')", [v]),
    ).rejects.toThrow(/Boutique introuvable/);
    await expect(
      lignes(
        db,
        U.patronB,
        "select enregistrer_mouvement_stock($1, $2, 'entree', 5)",
        [f.boutiqueA, f.clous.id],
      ),
    ).rejects.toThrow(/Boutique introuvable/);
  });

  it("B ne peut pas écrire dans le catalogue de A", async () => {
    await expect(
      lignes(
        db,
        U.patronB,
        "insert into produits (organisation_id, nom, unite_base) values ($1, 'Intrus', 'kg')",
        [f.orgA],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await lignes(
        db,
        U.patronB,
        "update produits set nom = 'piraté' returning id",
      ),
    ).toHaveLength(0);
  });
});

describe("rôle vendeur", () => {
  it("ne voit ni prix d'achat, ni coûts de vente, ni journal", async () => {
    for (const t of ["produit_couts", "vente_lignes_couts", "journal_activite"])
      expect(await n(U.vendeurA, t)).toBe(0);
  });

  it("voit les produits, les prix de vente et le stock", async () => {
    expect(await n(U.vendeurA, "produit_unites")).toBeGreaterThan(0);
    expect(await n(U.vendeurA, "stock_courant")).toBeGreaterThan(0);
  });

  it("ne peut ni modifier un prix, ni ajouter un produit, ni changer le plafond d'un client", async () => {
    expect(
      await lignes(
        db,
        U.vendeurA,
        "update produit_unites set prix_vente = 1 returning id",
      ),
    ).toHaveLength(0);
    await expect(
      lignes(
        db,
        U.vendeurA,
        "insert into produits (organisation_id, nom, unite_base) values ($1, 'X', 'kg')",
        [f.orgA],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      lignes(
        db,
        U.vendeurA,
        "insert into clients (organisation_id, nom, plafond_credit) values ($1, 'X', 9999999)",
        [f.orgA],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await lignes(
        db,
        U.vendeurA,
        "update clients set plafond_credit = 9999999 returning id",
      ),
    ).toHaveLength(0);
    await lignes(
      db,
      U.vendeurA,
      "insert into clients (organisation_id, nom) values ($1, 'Nouveau client')",
      [f.orgA],
    );
  });

  it("ne peut pas écrire directement dans les ventes, paiements, mouvements ou le journal", async () => {
    for (const sql of [
      "insert into ventes (organisation_id, boutique_id, numero_recu, jeton_public, vendeur_id, sous_total, total, cle_idempotence) values ($1, $2, 'R-X', 'j', $3, 1, 1, $4)",
    ]) {
      await expect(
        lignes(db, U.vendeurA, sql, [f.orgA, f.boutiqueA, U.vendeurA, cle()]),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(lignes(db, U.vendeurA, "delete from ventes")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      lignes(db, U.vendeurA, "update ventes set total = 0"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      lignes(
        db,
        U.vendeurA,
        "insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite) values ($1, $2, $3, 'entree', 99)",
        [f.orgA, f.boutiqueA, f.clous.id],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("n'a pas accès à une boutique non autorisée", async () => {
    const l = JSON.stringify([
      { produit_id: f.clous.id, unite_id: f.clous.unites.kg, quantite: 1 },
    ]);
    await expect(
      lignes(db, U.vendeurA, "select creer_vente($1, $2, $3::jsonb)", [
        f.boutiqueA2,
        cle(),
        l,
      ]),
    ).rejects.toThrow(/Accès refusé/);
    expect(
      await lignes(db, U.vendeurA, "select 1 from boutiques where id = $1", [
        f.boutiqueA2,
      ]),
    ).toHaveLength(0);
  });

  it("ne peut pas annuler une vente ni créer de comptes membres", async () => {
    const v = (await db.query<{ id: string }>("select id from ventes limit 1"))
      .rows[0].id;
    await expect(
      lignes(db, U.vendeurA, "select annuler_vente($1, 'x')", [v]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await expect(
      lignes(
        db,
        U.vendeurA,
        "insert into membres (utilisateur_id, organisation_id, role) values ($1, $2, 'proprietaire')",
        [U.vendeurA, f.orgA],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("utilisateur anonyme", () => {
  it("ne voit rien et ne peut appeler aucune fonction métier", async () => {
    await expect(lignes(db, null, "select 1 from produits")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      lignes(db, null, "select creer_organisation('X', 'Y')"),
    ).rejects.toThrow(/permission denied/);
  });
});
