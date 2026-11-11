import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;

const unites = (...u: object[]) => JSON.stringify(u);
const creer = (
  user: string,
  boutique: string,
  nom: string,
  u: string,
  extra: Record<string, unknown> = {},
) =>
  lignes<{ id: string }>(
    db,
    user,
    "select enregistrer_produit($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, null, true, $11) as id",
    [
      boutique,
      extra.id ?? null,
      nom,
      extra.categorie ?? null,
      extra.base ?? "pièce",
      extra.seuil ?? 0,
      extra.achat ?? 100,
      u,
      extra.image ?? null,
      extra.vignette ?? null,
      extra.marque ?? null,
    ],
  ).then((r) => r[0].id);
const lister = (user: string, boutique: string, ...args: unknown[]) =>
  lignes<{
    r: {
      produits: Record<string, unknown>[];
      suivant: { nom: string; id: string } | null;
    };
  }>(db, user, "select lister_produits($1, $2, $3, $4, $5, $6, $7, $8) as r", [
    boutique,
    args[0] ?? null,
    args[1] ?? null,
    args[2] ?? false,
    args[3] ?? 30,
    args[4] ?? null,
    args[5] ?? null,
    args[6] ?? null,
  ]).then((r) => r[0].r);

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
});

describe("enregistrer_produit", () => {
  it("crée un produit avec ses unités et son prix d'achat en une fois", async () => {
    const id = await creer(
      U.patronA,
      f.boutiqueA,
      "Tôle ondulée 3 m",
      unites({ nom: "pièce", facteur: 1, prix_vente: 5500 }),
      { achat: 4500, seuil: 20 },
    );
    const c = await db.query<{ prix_achat: string }>(
      "select prix_achat from produit_couts where produit_id = $1",
      [id],
    );
    expect(Number(c.rows[0].prix_achat)).toBe(4500);
    expect(
      (
        await db.query("select 1 from produit_unites where produit_id = $1", [
          id,
        ])
      ).rows,
    ).toHaveLength(1);
  });

  it("modifie : met à jour les prix, archive les unités retirées, journalise le changement de prix", async () => {
    const id = await creer(
      U.patronA,
      f.boutiqueA,
      "Fer 10",
      unites(
        { nom: "barre", facteur: 1, prix_vente: 5200 },
        { nom: "paquet", facteur: 10, prix_vente: 50000 },
      ),
      { base: "barre" },
    );
    const u = (
      await db.query<{ id: string; nom: string }>(
        "select id, nom from produit_unites where produit_id = $1",
        [id],
      )
    ).rows;
    const barre = u.find((x) => x.nom === "barre")!;
    await creer(
      U.patronA,
      f.boutiqueA,
      "Fer 10 mm",
      unites({ id: barre.id, nom: "barre", facteur: 1, prix_vente: 5400 }),
      { id, base: "barre", achat: 4300 },
    );
    const apres = await db.query<{
      nom: string;
      prix_vente: string;
      archive_le: string | null;
    }>(
      "select nom, prix_vente, archive_le from produit_unites where produit_id = $1 order by nom",
      [id],
    );
    expect(apres.rows.find((x) => x.nom === "barre")?.prix_vente).toBe(5400);
    expect(
      apres.rows.find((x) => x.nom === "paquet")?.archive_le,
    ).not.toBeNull();
    expect(
      (
        await db.query(
          "select 1 from journal_activite where action = 'prix_modifie' and entite_id = $1",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  });

  it("refuse de changer l'unité de base d'un produit qui a des mouvements de stock", async () => {
    const u = (
      await db.query<{ id: string }>(
        "select id from produit_unites where produit_id = $1",
        [f.clous.id],
      )
    ).rows[0].id;
    await expect(
      creer(
        U.patronA,
        f.boutiqueA,
        "Clous",
        unites({ id: u, nom: "kg", facteur: 1, prix_vente: 1200 }),
        { id: f.clous.id, base: "sac" },
      ),
    ).rejects.toThrow(/unité de base/);
  });

  it.each([
    ["sans unité", "[]", /au moins une unité/],
    [
      "facteur nul",
      unites({ nom: "x", facteur: 0, prix_vente: 1 }),
      /invalide/,
    ],
    [
      "facteur à 4 décimales",
      unites({ nom: "x", facteur: 0.0001, prix_vente: 1 }),
      /invalide/,
    ],
    [
      "prix négatif",
      unites({ nom: "x", facteur: 1, prix_vente: -5 }),
      /invalide/,
    ],
    [
      "noms en double",
      unites(
        { nom: "Sac", facteur: 1, prix_vente: 1 },
        { nom: " sac ", facteur: 2, prix_vente: 2 },
      ),
      /même nom/,
    ],
  ])("refuse %s", async (_n, u, message) => {
    await expect(creer(U.patronA, f.boutiqueA, "Test", u)).rejects.toThrow(
      message,
    );
  });

  it("est réservée au propriétaire de la boutique, et l'image doit appartenir à son organisation", async () => {
    const u = unites({ nom: "pièce", facteur: 1, prix_vente: 100 });
    await expect(creer(U.vendeurA, f.boutiqueA, "Intrus", u)).rejects.toThrow(
      /Seul le propriétaire/,
    );
    await expect(creer(U.patronB, f.boutiqueA, "Intrus", u)).rejects.toThrow(
      /Boutique introuvable/,
    );
    await expect(
      creer(U.patronA, f.boutiqueA, "Photo", u, {
        image: `${f.orgB}/${"a".repeat(64)}.webp`,
      }),
    ).rejects.toThrow(/Image invalide/);
    await creer(U.patronA, f.boutiqueA, "Photo ok", u, {
      image: `${f.orgA}/${"a".repeat(64)}.webp`,
      vignette: `${f.orgA}/${"a".repeat(64)}-v.webp`,
    });
  });

  it("ne peut pas modifier le produit d'une autre organisation", async () => {
    const idB = await creer(
      U.patronB,
      f.boutiqueB,
      "Produit B",
      unites({ nom: "pièce", facteur: 1, prix_vente: 100 }),
    );
    await expect(
      creer(
        U.patronA,
        f.boutiqueA,
        "Piraté",
        unites({ nom: "pièce", facteur: 1, prix_vente: 1 }),
        { id: idB },
      ),
    ).rejects.toThrow(/Produit introuvable/);
  });

  it("est bloquée quand l'abonnement est suspendu", async () => {
    await db.query(
      "update abonnements set statut = 'suspendu' where organisation_id = $1",
      [f.orgA],
    );
    await expect(
      creer(
        U.patronA,
        f.boutiqueA,
        "Bloqué",
        unites({ nom: "pièce", facteur: 1, prix_vente: 1 }),
      ),
    ).rejects.toThrow(/lecture seule/);
    await db.query(
      "update abonnements set statut = 'actif' where organisation_id = $1",
      [f.orgA],
    );
  });
});

describe("lister_produits", () => {
  it("cherche sans tenir compte des accents ni de la casse", async () => {
    for (const terme of ["tole", "TÔLE", "ondul"]) {
      const r = await lister(U.vendeurA, f.boutiqueA, terme);
      expect(r.produits.map((p) => p.nom)).toEqual(["Tôle ondulée 3 m"]);
    }
  });
  it("traite % et _ comme des caractères ordinaires", async () => {
    expect((await lister(U.vendeurA, f.boutiqueA, "%")).produits).toHaveLength(
      0,
    );
  });
  it("donne le stock de la boutique, le stock bas et les unités triées", async () => {
    const r = await lister(U.vendeurA, f.boutiqueA, "ciment");
    const p = r.produits[0];
    expect(Number(p.stock)).toBe(250);
    expect(p.stock_bas).toBe(false);
    expect((p.unites as { nom: string }[]).map((u) => u.nom)).toEqual([
      "sac",
      "kg",
    ]);
  });
  it("filtre les produits en stock bas", async () => {
    await db.query("update produits set seuil_alerte = 1000 where id = $1", [
      f.ciment.id,
    ]);
    const bas = await lister(U.vendeurA, f.boutiqueA, null, null, true);
    expect(bas.produits.map((p) => p.id)).toContain(f.ciment.id);
    expect(bas.produits.every((p) => p.stock_bas === true)).toBe(true);
    await db.query("update produits set seuil_alerte = 100 where id = $1", [
      f.ciment.id,
    ]);
  });
  it("pagine par curseur sans doublon ni oubli", async () => {
    const tous = (
      await lister(U.patronA, f.boutiqueA, null, null, false, 100)
    ).produits.map((p) => p.id);
    expect(tous.length).toBeGreaterThanOrEqual(5);
    const vus: unknown[] = [];
    let page = await lister(U.patronA, f.boutiqueA, null, null, false, 2);
    for (;;) {
      expect(page.produits.length).toBeLessThanOrEqual(2);
      vus.push(...page.produits.map((p) => p.id));
      if (!page.suivant) break;
      page = await lister(
        U.patronA,
        f.boutiqueA,
        null,
        null,
        false,
        2,
        page.suivant.nom,
        page.suivant.id,
      );
    }
    expect(vus).toEqual(tous);
  });
  it("ne contient jamais le prix d'achat, même pour le propriétaire", async () => {
    const r = await lister(U.patronA, f.boutiqueA);
    expect(JSON.stringify(r)).not.toMatch(/prix_achat|cout/);
  });
  it("n'expose ni les produits d'une autre organisation ni une boutique non autorisée", async () => {
    expect(
      (await lister(U.patronB, f.boutiqueB)).produits.map((p) => p.nom),
    ).toEqual(["Produit B"]);
    await expect(lister(U.vendeurA, f.boutiqueA2)).rejects.toThrow(
      /Accès refusé/,
    );
    await expect(lister(U.patronB, f.boutiqueA)).rejects.toThrow(
      /Accès refusé/,
    );
  });
  it("masque les produits archivés", async () => {
    await lignes(db, U.patronA, "select archiver_produit($1, $2, true)", [
      f.boutiqueA,
      f.clous.id,
    ]);
    expect(
      (await lister(U.vendeurA, f.boutiqueA, "clous")).produits,
    ).toHaveLength(0);
    await expect(
      lignes(db, U.vendeurA, "select archiver_produit($1, $2, false)", [
        f.boutiqueA,
        f.clous.id,
      ]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await lignes(db, U.patronA, "select archiver_produit($1, $2, false)", [
      f.boutiqueA,
      f.clous.id,
    ]);
    expect(
      (await lister(U.vendeurA, f.boutiqueA, "clous")).produits,
    ).toHaveLength(1);
  });
});

describe("rien ne se perd", () => {
  it("garde les ventes d'un produit dont une unité a été retirée", async () => {
    const id = await creer(
      U.patronA,
      f.boutiqueA,
      "Peinture",
      unites(
        { nom: "pot", facteur: 1, prix_vente: 8500 },
        { nom: "seau", facteur: 4, prix_vente: 32000 },
      ),
      { base: "pot" },
    );
    const u = (
      await db.query<{ id: string; nom: string }>(
        "select id, nom from produit_unites where produit_id = $1",
        [id],
      )
    ).rows;
    const seau = u.find((x) => x.nom === "seau")!;
    await lignes(
      db,
      U.patronA,
      "select enregistrer_mouvement_stock($1, $2, 'entree', 10)",
      [f.boutiqueA, id],
    );
    await lignes(
      db,
      U.vendeurA,
      'select creer_vente($1, $2, $3::jsonb, \'[{"mode":"especes"}]\')',
      [
        f.boutiqueA,
        cle(),
        JSON.stringify([{ produit_id: id, unite_id: seau.id, quantite: 1 }]),
      ],
    );
    const pot = u.find((x) => x.nom === "pot")!;
    await creer(
      U.patronA,
      f.boutiqueA,
      "Peinture",
      unites({ id: pot.id, nom: "pot", facteur: 1, prix_vente: 8500 }),
      { id, base: "pot" },
    );
    expect(
      (
        await db.query("select 1 from vente_lignes where unite_id = $1", [
          seau.id,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select 1 from produit_unites where id = $1 and archive_le is not null",
          [seau.id],
        )
      ).rows,
    ).toHaveLength(1);
  });
});

describe("marques : un même article en plusieurs marques et conditionnements", () => {
  let dangote: string;
  let cimaf: string;
  const marque = async (user: string, nom: string) =>
    (
      await lignes<{ id: string }>(
        db,
        user,
        "insert into marques (organisation_id, nom) values ($1, $2) returning id",
        [f.orgA, nom],
      )
    )[0].id;
  const conditionnements = unites(
    { nom: "sac de 50 kg", facteur: 50, prix_vente: 5500 },
    { nom: "sac de 25 kg", facteur: 25, prix_vente: 2900 },
    { nom: "kg", facteur: 1, prix_vente: 130 },
  );

  beforeAll(async () => {
    dangote = await marque(U.patronA, "Dangote");
    cimaf = await marque(U.patronA, "CIMAF");
  });

  it("crée le même ciment dans deux marques, avec leurs propres prix et stocks", async () => {
    const a = await creer(
      U.patronA,
      f.boutiqueA,
      "Ciment CPJ 42,5",
      conditionnements,
      { base: "kg", marque: dangote },
    );
    const b = await creer(
      U.patronA,
      f.boutiqueA,
      "Ciment CPJ 42,5",
      conditionnements.replace("5500", "5600"),
      { base: "kg", marque: cimaf },
    );
    expect(a).not.toBe(b);
    await lignes(
      db,
      U.patronA,
      "select enregistrer_mouvement_stock($1, $2, 'entree', 40, null)",
      [f.boutiqueA, a],
    );
    const liste = await lister(U.vendeurA, f.boutiqueA, "cpj");
    const noms = liste.produits.map((p) => p.nom_affiche);
    expect(noms).toEqual([
      "Ciment CPJ 42,5 · CIMAF",
      "Ciment CPJ 42,5 · Dangote",
    ]);
    const stockParMarque = Object.fromEntries(
      liste.produits.map((p) => [p.marque_nom, Number(p.stock)]),
    );
    expect(stockParMarque).toEqual({ CIMAF: 0, Dangote: 40 });
  });

  it("propose plusieurs conditionnements par produit, du plus grand au plus petit", async () => {
    const [p] = (await lister(U.vendeurA, f.boutiqueA, "dangote")).produits;
    expect((p.unites as { nom: string }[]).map((u) => u.nom)).toEqual([
      "sac de 50 kg",
      "sac de 25 kg",
      "kg",
    ]);
  });

  it("trouve un produit par sa marque, filtre par marque", async () => {
    expect(
      (await lister(U.vendeurA, f.boutiqueA, "cimaf")).produits,
    ).toHaveLength(1);
    const filtre = await lister(
      U.vendeurA,
      f.boutiqueA,
      null,
      null,
      false,
      30,
      null,
      null,
      dangote,
    );
    expect(filtre.produits.every((p) => p.marque_id === dangote)).toBe(true);
    expect(filtre.produits).toHaveLength(1);
  });

  it("refuse deux fois le même produit dans la même marque, mais accepte une autre marque", async () => {
    await expect(
      creer(U.patronA, f.boutiqueA, "ciment cpj 42,5", conditionnements, {
        base: "kg",
        marque: dangote,
      }),
    ).rejects.toThrow(/existe déjà avec cette marque/);
    const autre = await marque(U.patronA, "Mahima");
    await creer(U.patronA, f.boutiqueA, "Ciment CPJ 42,5", conditionnements, {
      base: "kg",
      marque: autre,
    });
  });

  it("garde un ciment blanc en sacs plus petits, indépendant du ciment gris", async () => {
    const blanc = await creer(
      U.patronA,
      f.boutiqueA,
      "Ciment blanc",
      unites(
        { nom: "sac de 25 kg", facteur: 25, prix_vente: 9500 },
        { nom: "sac de 5 kg", facteur: 5, prix_vente: 2000 },
        { nom: "kg", facteur: 1, prix_vente: 420 },
      ),
      { base: "kg", marque: cimaf },
    );
    await lignes(
      db,
      U.patronA,
      "select enregistrer_mouvement_stock($1, $2, 'entree', 4, $3)",
      [
        f.boutiqueA,
        blanc,
        (
          await db.query<{ id: string }>(
            "select id from produit_unites where produit_id = $1 and nom = 'sac de 25 kg'",
            [blanc],
          )
        ).rows[0].id,
      ],
    );
    expect(
      Number(
        (await lister(U.vendeurA, f.boutiqueA, "blanc")).produits[0].stock,
      ),
    ).toBe(100);
  });

  it("renommer une marque met à jour les noms et la recherche de ses produits", async () => {
    await lignes(
      db,
      U.patronA,
      "update marques set nom = 'Dangote Cameroun' where id = $1",
      [dangote],
    );
    expect(
      (await lister(U.vendeurA, f.boutiqueA, "dangote cameroun")).produits.map(
        (p) => p.nom_affiche,
      ),
    ).toEqual(["Ciment CPJ 42,5 · Dangote Cameroun"]);
  });

  it("garde la marque sur le reçu", async () => {
    const [p] = (await lister(U.vendeurA, f.boutiqueA, "dangote")).produits;
    const unite = (p.unites as { id: string; nom: string }[]).find(
      (u) => u.nom === "kg",
    )!;
    const r = await lignes<{ r: { vente_id: string } }>(
      db,
      U.vendeurA,
      'select creer_vente($1, $2, $3::jsonb, \'[{"mode":"especes"}]\') as r',
      [
        f.boutiqueA,
        cle(),
        JSON.stringify([{ produit_id: p.id, unite_id: unite.id, quantite: 2 }]),
      ],
    );
    const l = await db.query<{ nom_produit: string }>(
      "select nom_produit from vente_lignes where vente_id = $1",
      [r[0].r.vente_id],
    );
    expect(l.rows[0].nom_produit).toBe("Ciment CPJ 42,5 · Dangote Cameroun");
  });

  it("limite les marques à l'organisation et au propriétaire", async () => {
    await expect(
      lignes(
        db,
        U.vendeurA,
        "insert into marques (organisation_id, nom) values ($1, 'Intrus')",
        [f.orgA],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      lignes(
        db,
        U.patronB,
        "insert into marques (organisation_id, nom) values ($1, 'Intrus')",
        [f.orgA],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await lignes(db, U.patronB, "select 1 from marques")).toHaveLength(
      0,
    );
    await expect(
      lignes(
        db,
        U.patronB,
        "select enregistrer_produit($1, null, 'X', null, 'kg', 0, 0, $2::jsonb, null, null, null, true, $3)",
        [f.boutiqueB, conditionnements, dangote],
      ),
    ).rejects.toThrow(/Marque introuvable/);
  });

  it("refuse deux marques au même nom (casse et accents ignorés)", async () => {
    await expect(marque(U.patronA, "cimaf")).rejects.toThrow(
      /unique|duplicate/i,
    );
  });
});
