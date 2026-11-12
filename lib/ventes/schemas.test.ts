import { describe, expect, it } from "vitest";
import { clientRapideSchema, venteSchema } from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const base = {
  cle: ID,
  lignes: [{ produitId: ID, uniteId: ID, quantite: 2.5 }],
  paiements: [{ mode: "especes" }],
};

describe("venteSchema", () => {
  it("accepte une vente simple avec des valeurs par défaut", () => {
    const r = venteSchema.parse(base);
    expect(r).toMatchObject({ remise: 0, forcer: false });
    expect(r.lignes[0].remiseLigne).toBe(0);
  });
  it.each([
    ["sans article", { ...base, lignes: [] }],
    [
      "quantité nulle",
      { ...base, lignes: [{ ...base.lignes[0], quantite: 0 }] },
    ],
    [
      "4 décimales",
      { ...base, lignes: [{ ...base.lignes[0], quantite: 1.0001 }] },
    ],
    ["mode inconnu", { ...base, paiements: [{ mode: "cheque" }] }],
    [
      "montant décimal",
      { ...base, paiements: [{ mode: "especes", montant: 10.5 }] },
    ],
    ["remise négative", { ...base, remise: -1 }],
    ["clé invalide", { ...base, cle: "abc" }],
  ])("refuse %s", (_n, v) =>
    expect(venteSchema.safeParse(v).success).toBe(false),
  );
  it("n'accepte aucun prix envoyé par le client (le serveur recalcule)", () => {
    const r = venteSchema.parse({
      ...base,
      lignes: [{ ...base.lignes[0], prix: 1 }],
      total: 1,
    });
    expect(JSON.stringify(r)).not.toMatch(/"prix"|"total"/);
  });
});

describe("clientRapideSchema", () => {
  it("normalise le téléphone, facultatif", () => {
    expect(
      clientRapideSchema.parse({
        nom: "Jean Mbarga",
        telephone: "699 11 11 11",
      }).telephone,
    ).toBe("+237699111111");
    expect(
      clientRapideSchema.parse({ nom: "Jean Mbarga" }).telephone,
    ).toBeUndefined();
  });
  it("refuse un numéro invalide ou un nom trop court", () => {
    expect(
      clientRapideSchema.safeParse({ nom: "Jean", telephone: "12" }).success,
    ).toBe(false);
    expect(clientRapideSchema.safeParse({ nom: "J" }).success).toBe(false);
  });
});
