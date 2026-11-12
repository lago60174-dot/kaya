import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { arrondirProduit } from "@/lib/ventes/panier";
import { creerBase } from "./helpers";

let db: PGlite;
beforeAll(async () => {
  db = await creerBase();
});

/** L'aperçu du panier (TypeScript) doit donner exactement les montants de la base : même arrondi, y compris sur les .5. */
describe("aperçu du panier = calcul de la base", () => {
  const quantites = [
    0.001, 0.005, 0.02, 0.1, 0.333, 0.5, 0.75, 1, 1.001, 1.005, 2.5, 7.125,
    12.345, 100, 999.999,
  ];
  const prix = [1, 3, 130, 450, 1301, 1999, 5500, 32000, 99999];
  it("sur toutes les combinaisons de quantités et de prix testées", async () => {
    for (const q of quantites) {
      for (const p of prix) {
        const sql = await db.query<{ r: string }>(
          "select round($1::numeric * $2::bigint)::text as r",
          [q, p],
        );
        expect(arrondirProduit(q, p), `${q} x ${p}`).toBe(
          Number(sql.rows[0].r),
        );
      }
    }
  });
});
