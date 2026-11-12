import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;
let venteId: string;

const vendre = (
  user: string,
  boutique: string,
  paiements: object[],
  client: string | null = null,
) =>
  lignes<{
    r: { vente_id: string; numero_recu: string; jeton_public: string };
  }>(db, user, "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5) as r", [
    boutique,
    cle(),
    JSON.stringify([
      { produit_id: f.ciment.id, unite_id: f.ciment.unites.sac, quantite: 1 },
      { produit_id: f.clous.id, unite_id: f.clous.unites.kg, quantite: 0.5 },
    ]),
    JSON.stringify(paiements),
    client,
  ]).then((r) => r[0].r);

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
  await db.query(
    "update clients set telephone = '+237699111111' where id = $1",
    [f.client],
  );
  venteId = (
    await vendre(
      U.vendeurA,
      f.boutiqueA,
      [{ mode: "especes", montant: 3000 }],
      f.client,
    )
  ).vente_id;
});

describe("ce que l'écran du reçu lit", () => {
  it("le vendeur lit la vente, ses lignes, ses paiements, le crédit et le client", async () => {
    const [v] = await lignes<{ total: string; numero_recu: string }>(
      db,
      U.vendeurA,
      "select total, numero_recu from ventes where id = $1",
      [venteId],
    );
    expect(Number(v.total)).toBe(6100); // 5 500 + 0,5 x 1 200
    expect(v.numero_recu).toMatch(/^R-\d{4}-000001$/);
    const l = await lignes<{
      nom_produit: string;
      nom_unite: string;
      total_ligne: string;
    }>(
      db,
      U.vendeurA,
      "select nom_produit, nom_unite, total_ligne from vente_lignes where vente_id = $1 order by nom_produit",
      [venteId],
    );
    expect(
      l.map((x) => [x.nom_produit, x.nom_unite, Number(x.total_ligne)]),
    ).toEqual([
      ["Ciment 50 kg", "sac", 5500],
      ["Clous 3 pouces", "kg", 600],
    ]);
    const p = await lignes<{ mode: string; montant: string }>(
      db,
      U.vendeurA,
      "select mode, montant from paiements where vente_id = $1 and type = 'vente'",
      [venteId],
    );
    expect(p.map((x) => [x.mode, Number(x.montant)])).toEqual([
      ["especes", 3000],
    ]);
    const c = await lignes<{ solde: string; statut: string }>(
      db,
      U.vendeurA,
      "select solde, statut from creances where vente_id = $1",
      [venteId],
    );
    expect([Number(c[0].solde), c[0].statut]).toEqual([3100, "ouverte"]);
    expect(
      (
        await lignes(
          db,
          U.vendeurA,
          "select nom, telephone from clients where id = $1",
          [f.client],
        )
      )[0],
    ).toMatchObject({ telephone: "+237699111111" });
    expect(
      await lignes(
        db,
        U.vendeurA,
        "select nom, mention_legale from boutiques where id = $1",
        [f.boutiqueA],
      ),
    ).toHaveLength(1);
  });

  it("le vendeur ne voit jamais le coût d'achat de la vente", async () => {
    expect(
      await lignes(db, U.vendeurA, "select * from vente_lignes_couts"),
    ).toHaveLength(0);
    const owner = await lignes<{ cout_total: string }>(
      db,
      U.patronA,
      "select cout_total from vente_lignes_couts order by cout_total desc",
    );
    expect(owner.map((x) => Number(x.cout_total))).toEqual([4750, 450]);
  });

  it("le jeton public du reçu est long et imprévisible", async () => {
    const r = await vendre(U.vendeurA, f.boutiqueA, [{ mode: "especes" }]);
    expect(r.jeton_public).toMatch(/^[0-9a-f]{64}$/);
    const autre = await vendre(U.vendeurA, f.boutiqueA, [{ mode: "especes" }]);
    expect(autre.jeton_public).not.toBe(r.jeton_public);
  });

  it("un vendeur ne voit pas les ventes d'une boutique qui ne lui est pas attribuée", async () => {
    const vente = await vendre(U.patronA, f.boutiqueA2, [
      { mode: "especes" },
    ]).catch(() => null);
    // pas de stock dans la 2e boutique : la vente est refusée, et aucune trace n'apparaît pour le vendeur
    expect(vente).toBeNull();
    expect(
      await lignes(
        db,
        U.vendeurA,
        "select 1 from ventes where boutique_id = $1",
        [f.boutiqueA2],
      ),
    ).toHaveLength(0);
  });

  it("un paiement mixte avec une partie à crédit est enregistré en entier ou pas du tout", async () => {
    const avant = Number(
      (await db.query<{ n: string }>("select count(*) n from paiements"))
        .rows[0].n,
    );
    await expect(
      lignes(
        db,
        U.vendeurA,
        "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5)",
        [
          f.boutiqueA,
          cle(),
          JSON.stringify([
            {
              produit_id: f.ciment.id,
              unite_id: f.ciment.unites.sac,
              quantite: 1,
            },
          ]),
          JSON.stringify([
            { mode: "especes", montant: 1000 },
            { mode: "mtn_momo", montant: 1000 },
          ]),
          null,
        ],
      ),
    ).rejects.toThrow(/Choisissez un client/);
    expect(
      Number(
        (await db.query<{ n: string }>("select count(*) n from paiements"))
          .rows[0].n,
      ),
    ).toBe(avant);
  });
});
