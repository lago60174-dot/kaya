import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;

interface Tableau {
  jour: string;
  caisse: Record<string, number>;
  ventes_hier: number;
  produits_vendus: {
    produit_id: string;
    nom: string;
    quantite_base: number;
    montant: number;
  }[];
  stock_bas: {
    nombre: number;
    produits: { nom: string; stock: number; seuil: number }[];
  };
  dettes: { total: number; nb_clients: number };
  vendeurs: { nom: string; nb_ventes: number; total: number }[];
  clotures_a_valider: number;
}

const tableau = (user: string | null, boutique = f.boutiqueA) =>
  lignes<{ r: Tableau }>(db, user, "select tableau_de_bord($1) as r", [
    boutique,
  ]).then((x) => x[0].r);

const vendre = (
  user: string,
  produit: { id: string; unites: Record<string, string> },
  unite: string,
  q: number,
  paiements: unknown[] = [{ mode: "especes" }],
  client: string | null = null,
) =>
  lignes<{ r: { vente_id: string; total: number } }>(
    db,
    user,
    "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5) as r",
    [
      f.boutiqueA,
      cle(),
      JSON.stringify([
        {
          produit_id: produit.id,
          unite_id: produit.unites[unite],
          quantite: q,
        },
      ]),
      JSON.stringify(paiements),
      client,
    ],
  ).then((x) => x[0].r);

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
});

describe("tableau_de_bord", () => {
  it("est vide mais complet pour une boutique sans vente", async () => {
    const t = await tableau(U.patronA);
    expect(t.caisse.ventes_total).toBe(0);
    expect(t.ventes_hier).toBe(0);
    expect(t.produits_vendus).toEqual([]);
    expect(t.vendeurs).toEqual([]);
    expect(t.dettes).toEqual({ total: 0, nb_clients: 0 });
    expect(t.clotures_a_valider).toBe(0);
    expect(t.stock_bas.nombre).toBe(0);
  });

  it("est réservé au propriétaire de la boutique", async () => {
    await expect(tableau(U.vendeurA)).rejects.toThrow(
      /réservé au propriétaire/,
    );
    await expect(tableau(U.patronB)).rejects.toThrow(/Boutique introuvable/);
    await expect(tableau(null)).rejects.toThrow();
  });

  it("totalise les ventes du jour, par vendeur, et ignore les ventes annulées", async () => {
    const a = await vendre(U.vendeurA, f.ciment, "kg", 10);
    const b = await vendre(U.patronA, f.ciment, "sac", 1);
    const annulee = await vendre(U.vendeurA, f.ciment, "kg", 20);
    await lignes(db, U.patronA, "select annuler_vente($1, 'Erreur')", [
      annulee.vente_id,
    ]);
    const t = await tableau(U.patronA);
    expect(t.caisse.ventes_total).toBe(a.total + b.total);
    expect(t.caisse.nb_ventes).toBe(2);
    const total = t.vendeurs.reduce((s, v) => s + Number(v.total), 0);
    expect(total).toBe(a.total + b.total);
    expect(t.vendeurs).toHaveLength(2);
    expect(t.vendeurs[0].total).toBeGreaterThanOrEqual(t.vendeurs[1].total);
  });

  it("classe les produits les plus vendus en unité de base, annulations exclues", async () => {
    await vendre(U.vendeurA, f.clous, "kg", 3);
    const t = await tableau(U.patronA);
    const ciment = t.produits_vendus.find((p) => p.produit_id === f.ciment.id);
    // 10 kg + 1 sac de 50 kg = 60 kg ; la vente annulée de 20 kg n'est pas comptée.
    expect(Number(ciment?.quantite_base)).toBe(60);
    const clous = t.produits_vendus.find((p) => p.produit_id === f.clous.id);
    expect(Number(clous?.quantite_base)).toBe(3);
    const montants = t.produits_vendus.map((p) => Number(p.montant));
    expect(montants).toEqual([...montants].sort((x, y) => y - x));
  });

  it("signale le stock bas avec la même règle que l'alerte (stock < seuil, seuil > 0)", async () => {
    // Clous : 10 kg - 3 vendus = 7 kg. Seuil 0 : jamais bas.
    expect((await tableau(U.patronA)).stock_bas.nombre).toBe(0);
    await db.query("update produits set seuil_alerte = 7 where id = $1", [
      f.clous.id,
    ]);
    expect((await tableau(U.patronA)).stock_bas.nombre).toBe(0); // 7 n'est pas < 7
    await db.query("update produits set seuil_alerte = 8 where id = $1", [
      f.clous.id,
    ]);
    const t = await tableau(U.patronA);
    expect(t.stock_bas.nombre).toBe(1);
    expect(t.stock_bas.produits[0].nom).toContain("Clous");
    expect(Number(t.stock_bas.produits[0].stock)).toBe(7);
    // Un produit archivé n'apparaît pas.
    await db.query("update produits set archive_le = now() where id = $1", [
      f.clous.id,
    ]);
    expect((await tableau(U.patronA)).stock_bas.nombre).toBe(0);
  });

  it("totalise les dettes des clients et les clôtures à valider", async () => {
    await vendre(
      U.vendeurA,
      f.ciment,
      "kg",
      5,
      [{ mode: "especes", montant: 100 }],
      f.client,
    );
    const t = await tableau(U.patronA);
    expect(t.dettes.nb_clients).toBe(1);
    expect(Number(t.dettes.total)).toBe(5 * 130 - 100);
    await lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
      f.boutiqueA,
      t.jour,
    ]);
    expect((await tableau(U.patronA)).clotures_a_valider).toBe(1);
  });

  it("ne contient ni marge ni prix d'achat", async () => {
    const brut = JSON.stringify(await tableau(U.patronA));
    expect(brut).not.toMatch(/marge|prix_achat|cout/i);
  });
});
