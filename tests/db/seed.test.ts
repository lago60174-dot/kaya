import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBase } from "./helpers";

let db: PGlite;
const un = async (sql: string) =>
  Number(
    Object.values((await db.query<Record<string, string>>(sql)).rows[0])[0],
  );

beforeAll(async () => {
  db = await creerBase(true);
});

describe("jeu de démonstration", () => {
  it("contient 34 produits, 8 clients, 4 comptes et 20 ventes valides", async () => {
    expect(await un("select count(*) from produits")).toBe(34);
    expect(await un("select count(*) from clients")).toBe(8);
    expect(await un("select count(*) from auth.users")).toBe(4);
    expect(
      await un("select count(*) from ventes where statut = 'valide'"),
    ).toBe(20);
  });
  it("gère plusieurs marques pour un même article, et plusieurs conditionnements", async () => {
    expect(
      await un(
        "select count(*) from produits where nom = 'Ciment CPJ 42,5' and marque_id is not null",
      ),
    ).toBe(2);
    expect(await un("select count(distinct marque_id) from produits")).toBe(4);
    expect(
      await un(
        "select count(*) from produits where nom_affiche = 'Ciment CPJ 42,5 · CIMAF'",
      ),
    ).toBe(1);
    expect(
      await un(
        "select max(n) from (select count(*) n from produit_unites group by produit_id) t",
      ),
    ).toBeGreaterThanOrEqual(3);
  });
  it("a 3 clients avec un crédit en cours et des paiements variés", async () => {
    expect(
      await un(
        "select count(distinct client_id) from creances where statut = 'ouverte'",
      ),
    ).toBe(3);
    expect(await un("select count(distinct mode) from paiements")).toBe(3);
  });
  it("étale les ventes sur 7 jours", async () => {
    expect(
      await un(
        "select count(distinct (date at time zone 'Africa/Douala')::date) from ventes",
      ),
    ).toBe(7);
  });
  it("a des produits sous le seuil d'alerte, signalés dans le journal", async () => {
    expect(
      await un(
        "select count(*) from stock_courant s join produits p on p.id = s.produit_id where s.quantite < p.seuil_alerte",
      ),
    ).toBeGreaterThanOrEqual(4);
    expect(
      await un(
        "select count(*) from journal_activite where action = 'stock_bas'",
      ),
    ).toBeGreaterThanOrEqual(4);
  });
  it("ne laisse aucune erreur de stock : tout le stock est positif", async () => {
    expect(
      await un("select count(*) from stock_courant where quantite < 0"),
    ).toBe(0);
  });
});
