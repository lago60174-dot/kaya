import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

type Fixtures = Awaited<ReturnType<typeof preparer>>;

let db: PGlite;
let f: Fixtures;

// Base neuve avant chaque test : chacun part de « boutique A : 250 kg de ciment (5 sacs), 10 kg de clous ».
beforeEach(async () => {
  db = await creerBase();
  f = await preparer(db);
}, 120_000);

const appeler = <T = unknown>(user: string, sql: string, params: unknown[] = []) =>
  lignes<{ r: T }>(db, user, `select ${sql} as r`, params);

interface Ligne {
  produit_id: string;
  unite_id?: string | null;
  quantite: number;
}

const transferer = (
  user: string,
  source: string,
  destination: string,
  l: Ligne[],
  options: { cle?: string; note?: string | null } = {},
) =>
  appeler<{ id: string; deja_enregistre?: boolean; nb_produits?: number }>(
    user,
    "transferer_stock($1, $2, $3::jsonb, $4, $5)",
    [source, destination, JSON.stringify(l), options.cle ?? cle(), options.note ?? null],
  );

const stock = async (boutique: string, produit: string) => {
  const r = await db.query<{ quantite: string }>(
    "select quantite from stock_courant where boutique_id = $1 and produit_id = $2",
    [boutique, produit],
  );
  return r.rows.length ? Number(r.rows[0].quantite) : 0;
};

describe("transferer_stock", () => {
  it("déplace le stock d'une boutique à l'autre, en convertissant l'unité, et garde la trace", async () => {
    const r = (
      await transferer(
        U.patronA,
        f.boutiqueA,
        f.boutiqueA2,
        [
          { produit_id: f.ciment.id, unite_id: f.ciment.unites.sac, quantite: 2 }, // 2 sacs = 100 kg
          { produit_id: f.clous.id, quantite: 4 },
        ],
        { note: "Livraison du lundi" },
      )
    )[0].r;
    expect(r.nb_produits).toBe(2);
    expect(await stock(f.boutiqueA, f.ciment.id)).toBe(150);
    expect(await stock(f.boutiqueA2, f.ciment.id)).toBe(100);
    expect(await stock(f.boutiqueA, f.clous.id)).toBe(6);
    expect(await stock(f.boutiqueA2, f.clous.id)).toBe(4);

    // Deux mouvements par produit, liés au même transfert, et la somme du stock de l'organisation ne bouge pas.
    const m = await db.query<{ boutique_id: string; type: string; quantite: string; reference: string }>(
      "select boutique_id, type, quantite, reference from mouvements_stock where type like 'transfert%' order by produit_id, quantite",
    );
    expect(m.rows).toHaveLength(4);
    expect(new Set(m.rows.map((x) => x.reference))).toEqual(new Set([r.id]));
    expect(m.rows.reduce((s, x) => s + Number(x.quantite), 0)).toBe(0);
    expect(m.rows.filter((x) => x.type === "transfert_sortie").every((x) => x.boutique_id === f.boutiqueA)).toBe(true);

    // Historique : noms et quantités figés, lisibles par le propriétaire.
    const h = (
      await lignes<{ note: string; lignes: { nom: string; quantite: number; unite: string }[] }>(
        db,
        U.patronA,
        "select note, lignes from transferts_stock where id = $1",
        [r.id],
      )
    )[0];
    expect(h.note).toBe("Livraison du lundi");
    expect(h.lignes.find((x) => x.nom === "Ciment 50 kg")).toMatchObject({ quantite: 2, unite: "sac" });
    const j = await db.query<{ details: { de: string; nb_produits: number } }>(
      "select details from journal_activite where action = 'stock_transfere' and entite_id = $1",
      [r.id],
    );
    expect(j.rows).toHaveLength(1);
    expect(j.rows[0].details.nb_produits).toBe(2);
  });

  it("ne compte ni comme une perte ni comme une entrée d'achat, et ne touche pas au prix d'achat", async () => {
    const avant = await db.query("select prix_achat from produit_couts where produit_id = $1", [f.ciment.id]);
    await transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.ciment.id, quantite: 10 }]);
    const types = await db.query<{ type: string }>(
      "select distinct type from mouvements_stock where produit_id = $1 and boutique_id = $2 order by type",
      [f.ciment.id, f.boutiqueA2],
    );
    expect(types.rows.map((t) => t.type)).toEqual(["transfert_entree"]);
    expect((await db.query("select prix_achat from produit_couts where produit_id = $1", [f.ciment.id])).rows).toEqual(avant.rows);
  });

  it("refuse un stock insuffisant, même si le stock négatif est autorisé, et n'écrit rien", async () => {
    await db.query("update parametres_boutique set stock_negatif_autorise = true where boutique_id = $1", [f.boutiqueA]);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [
        { produit_id: f.clous.id, quantite: 2 },
        { produit_id: f.ciment.id, quantite: 251 }, // 250 kg disponibles
      ]),
    ).rejects.toThrow(/Stock insuffisant pour « Ciment 50 kg »/);
    expect(await stock(f.boutiqueA, f.clous.id)).toBe(10); // la 1re ligne n'a pas été appliquée non plus
    expect(await stock(f.boutiqueA, f.ciment.id)).toBe(250);
    expect((await db.query("select 1 from transferts_stock")).rows).toHaveLength(0);
    expect((await db.query("select 1 from mouvements_stock where type like 'transfert%'")).rows).toHaveLength(0);
  });

  it("deux transferts successifs ne peuvent pas dépasser le stock", async () => {
    await transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.ciment.id, quantite: 150 }]);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.ciment.id, quantite: 150 }]),
    ).rejects.toThrow(/Stock insuffisant/);
    expect(await stock(f.boutiqueA, f.ciment.id)).toBe(100);
  });

  it("est idempotent : la même clé ne déplace le stock qu'une fois", async () => {
    const k = cle();
    const l = [{ produit_id: f.clous.id, quantite: 3 }];
    const a = (await transferer(U.patronA, f.boutiqueA, f.boutiqueA2, l, { cle: k }))[0].r;
    const b = (await transferer(U.patronA, f.boutiqueA, f.boutiqueA2, l, { cle: k }))[0].r;
    expect(b.deja_enregistre).toBe(true);
    expect(b.id).toBe(a.id);
    expect(await stock(f.boutiqueA, f.clous.id)).toBe(7);
    expect(await stock(f.boutiqueA2, f.clous.id)).toBe(3);
  });

  it("peut se faire dans les deux sens", async () => {
    await transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: 5 }]);
    await transferer(U.patronA, f.boutiqueA2, f.boutiqueA, [{ produit_id: f.clous.id, quantite: 2 }]);
    expect(await stock(f.boutiqueA, f.clous.id)).toBe(7);
    expect(await stock(f.boutiqueA2, f.clous.id)).toBe(3);
  });
});

describe("transferer_stock : droits et validations", () => {
  const un = (q = 1): Ligne[] => [{ produit_id: "", quantite: q }];

  it("est réservé au propriétaire, même pour un vendeur qui a accès aux deux boutiques", async () => {
    const vendeur = (await db.query<{ id: string }>("select id from membres where utilisateur_id = $1", [U.vendeurA])).rows[0].id;
    await appeler(U.patronA, "definir_boutiques_vendeur($1, $2)", [vendeur, [f.boutiqueA, f.boutiqueA2]]);
    await expect(
      transferer(U.vendeurA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: 1 }]),
    ).rejects.toThrow(/Seul le propriétaire/);
    expect(await stock(f.boutiqueA, f.clous.id)).toBe(10);
  });

  it("ne traverse jamais les organisations", async () => {
    const l = [{ produit_id: f.clous.id, quantite: 1 }];
    await expect(transferer(U.patronA, f.boutiqueA, f.boutiqueB, l)).rejects.toThrow(/Boutique introuvable|Accès refusé/);
    await expect(transferer(U.patronB, f.boutiqueA, f.boutiqueA2, l)).rejects.toThrow(/Boutique introuvable|Accès refusé/);
    await expect(transferer(U.patronB, f.boutiqueB, f.boutiqueA, l)).rejects.toThrow(/Boutique introuvable|Accès refusé/);
  });

  it("refuse deux fois la même boutique, une liste vide ou trop longue, un produit en double ou inconnu, une quantité ou une unité invalide", async () => {
    const l = [{ produit_id: f.clous.id, quantite: 1 }];
    await expect(transferer(U.patronA, f.boutiqueA, f.boutiqueA, l)).rejects.toThrow(/deux boutiques différentes/);
    await expect(transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [])).rejects.toThrow(/au moins un produit/);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, Array.from({ length: 101 }, () => l[0])),
    ).rejects.toThrow(/limité à 100/);
    await expect(transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [l[0], l[0]])).rejects.toThrow(/qu'une fois/);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: cle(), quantite: 1 }]),
    ).rejects.toThrow(/Produit introuvable/);
    for (const q of [0, -3, 1.2345])
      await expect(
        transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: q }]),
      ).rejects.toThrow(/Quantité invalide/);
    // L'unité « sac » appartient au ciment, pas aux clous.
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [
        { produit_id: f.clous.id, unite_id: f.ciment.unites.sac, quantite: 1 },
      ]),
    ).rejects.toThrow(/Unité introuvable/);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: "pas-un-uuid", quantite: 1 }]),
    ).rejects.toThrow(/Ligne de transfert invalide/);
    expect(un().length).toBe(1);
    expect((await db.query("select 1 from transferts_stock")).rows).toHaveLength(0);
  });

  it("refuse un produit archivé", async () => {
    await db.query("update produits set archive_le = now() where id = $1", [f.clous.id]);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: 1 }]),
    ).rejects.toThrow(/Produit introuvable/);
  });

  it("refuse quand la boutique de destination dépasse le plan (lecture seule) ou que le compte est suspendu", async () => {
    await db.query(`update plans set limites = jsonb_build_object('vendeurs', null, 'boutiques', 1) where code = 'business'`);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: 1 }]),
    ).rejects.toThrow(/lecture seule/);
    await expect(
      transferer(U.patronA, f.boutiqueA2, f.boutiqueA, [{ produit_id: f.clous.id, quantite: 1 }]),
    ).rejects.toThrow(/lecture seule|Stock insuffisant/);
    expect(await stock(f.boutiqueA, f.clous.id)).toBe(10);
    await db.query(`update plans set limites = jsonb_build_object('vendeurs', null, 'boutiques', null) where code = 'business'`);
    await db.query("update abonnements set statut = 'suspendu' where organisation_id = $1", [f.orgA]);
    await expect(
      transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: 1 }]),
    ).rejects.toThrow(/lecture seule/);
  });

  it("l'historique est lisible par le propriétaire seulement, et ne se modifie ni ne se supprime", async () => {
    const id = (await transferer(U.patronA, f.boutiqueA, f.boutiqueA2, [{ produit_id: f.clous.id, quantite: 1 }]))[0].r.id;
    expect(await lignes(db, U.patronA, "select id from transferts_stock")).toHaveLength(1);
    expect(await lignes(db, U.vendeurA, "select id from transferts_stock")).toHaveLength(0);
    expect(await lignes(db, U.patronB, "select id from transferts_stock")).toHaveLength(0);
    await expect(lignes(db, U.patronA, "update transferts_stock set note = 'x' where id = $1", [id])).rejects.toThrow();
    await expect(lignes(db, U.patronA, "delete from transferts_stock where id = $1", [id])).rejects.toThrow();
    await expect(db.query("update transferts_stock set note = 'x' where id = $1", [id])).rejects.toThrow();
  });
});
