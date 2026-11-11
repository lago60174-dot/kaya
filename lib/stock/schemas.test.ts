import { describe, expect, it } from "vitest";
import { mouvementSchema, produitSchema } from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const unites = JSON.stringify([
  { nom: "sac", facteur: "50", prixVente: "5 500" },
  { nom: "kg", facteur: "1", prixVente: "130" },
]);
const produit = {
  nom: " Ciment ",
  uniteBase: "kg",
  seuilAlerte: "500",
  prixAchat: "95",
  unites,
  actif: "on",
};

describe("produitSchema", () => {
  it("convertit les textes saisis en nombres", () => {
    const r = produitSchema.parse(produit);
    expect(r).toMatchObject({
      nom: "Ciment",
      seuilAlerte: 500,
      prixAchat: 95,
      actif: true,
    });
    expect(r.unites).toEqual([
      { id: undefined, nom: "sac", facteur: 50, prixVente: 5500 },
      { id: undefined, nom: "kg", facteur: 1, prixVente: 130 },
    ]);
  });
  it("accepte une virgule dans le facteur et un seuil à zéro", () => {
    const u = JSON.stringify([{ nom: "m", facteur: "0,5", prixVente: "10" }]);
    expect(
      produitSchema.parse({ ...produit, seuilAlerte: "0", unites: u }).unites[0]
        .facteur,
    ).toBe(0.5);
  });
  it("lit la marque existante ou une nouvelle marque", () => {
    expect(
      produitSchema.parse({ ...produit, nouvelleMarque: " CIMAF " })
        .nouvelleMarque,
    ).toBe("CIMAF");
    expect(produitSchema.parse({ ...produit, marqueId: ID }).marqueId).toBe(ID);
    expect(
      produitSchema.parse({ ...produit, marqueId: "", nouvelleMarque: "" })
        .marqueId,
    ).toBeUndefined();
  });
  it("ignore les champs vides facultatifs", () => {
    const r = produitSchema.parse({
      ...produit,
      id: "",
      categorieId: "",
      imageCle: "",
    });
    expect(r.id).toBeUndefined();
    expect(r.imageCle).toBeUndefined();
  });
  it("refuse sans unité, avec deux unités de même nom, ou avec un JSON illisible", () => {
    expect(produitSchema.safeParse({ ...produit, unites: "[]" }).success).toBe(
      false,
    );
    expect(
      produitSchema.safeParse({
        ...produit,
        unites: JSON.stringify([
          { nom: "Sac", facteur: "1", prixVente: "1" },
          { nom: "sac", facteur: "2", prixVente: "2" },
        ]),
      }).error?.issues[0].message,
    ).toBe("Deux unités portent le même nom.");
    expect(
      produitSchema.safeParse({ ...produit, unites: "pas du json" }).error
        ?.issues[0].message,
    ).toBe("Les unités de vente sont illisibles.");
  });
  it("refuse un prix décimal et un facteur nul, avec des messages en français", () => {
    const m = (u: object) =>
      produitSchema.safeParse({ ...produit, unites: JSON.stringify([u]) }).error
        ?.issues[0].message;
    expect(m({ nom: "x", facteur: "1", prixVente: "12,5" })).toMatch(
      /sans décimales/,
    );
    expect(m({ nom: "x", facteur: "0", prixVente: "10" })).toMatch(
      /supérieur à zéro/,
    );
  });
  it("refuse une clé de photo qui n'est pas un fichier WebP d'organisation", () => {
    expect(
      produitSchema.safeParse({ ...produit, imageCle: "../../secret" }).success,
    ).toBe(false);
    expect(
      produitSchema.safeParse({
        ...produit,
        imageCle: `${ID}/${"a".repeat(64)}.webp`,
      }).success,
    ).toBe(true);
  });
});

describe("mouvementSchema", () => {
  const base = {
    boutiqueId: ID,
    produitId: ID,
    type: "entree",
    quantite: "2,5",
  };
  it("lit la quantité et le prix d'achat facultatif", () => {
    expect(
      mouvementSchema.parse({ ...base, prixAchat: "4 750" }),
    ).toMatchObject({ quantite: 2.5, prixAchat: 4750 });
    expect(
      mouvementSchema.parse({ ...base, prixAchat: "" }).prixAchat,
    ).toBeUndefined();
  });
  it("exige un motif pour une perte", () => {
    const r = mouvementSchema.safeParse({ ...base, type: "perte" });
    expect(r.error?.issues[0]).toMatchObject({ path: ["motif"] });
    expect(
      mouvementSchema.safeParse({ ...base, type: "perte", motif: "Casse" })
        .success,
    ).toBe(true);
  });
  it("accepte zéro pour un inventaire seulement", () => {
    expect(
      mouvementSchema.safeParse({ ...base, type: "inventaire", quantite: "0" })
        .success,
    ).toBe(true);
    expect(mouvementSchema.safeParse({ ...base, quantite: "0" }).success).toBe(
      false,
    );
  });
  it("refuse un type inconnu", () => {
    expect(mouvementSchema.safeParse({ ...base, type: "vol" }).success).toBe(
      false,
    );
  });
});
