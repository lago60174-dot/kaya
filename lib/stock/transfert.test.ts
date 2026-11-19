import { describe, expect, it } from "vitest";
import { enUniteDeBase, lireQuantite, transfertSchema } from "./transfert";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = {
  source: id(1),
  destination: id(2),
  cle: id(3),
  lignes: [{ produitId: id(10), quantite: 2 }],
};

describe("lireQuantite", () => {
  it("accepte la virgule et le point, jusqu'à 3 décimales", () => {
    expect(lireQuantite("12,5")).toBe(12.5);
    expect(lireQuantite(" 0.125 ")).toBe(0.125);
    expect(lireQuantite("1 250")).toBe(1250);
  });
  it("refuse le vide, zéro, le négatif, les lettres et les 4 décimales", () => {
    for (const t of ["", "0", "0,0", "-2", "abc", "1,2345", "1,,2"])
      expect(lireQuantite(t)).toBeNull();
  });
});

describe("enUniteDeBase", () => {
  it("convertit sans erreur d'arrondi visible", () => {
    expect(enUniteDeBase(3, 50)).toBe(150);
    expect(enUniteDeBase(0.1, 3)).toBe(0.3);
    expect(enUniteDeBase(1, 0.02)).toBe(0.02);
  });
});

describe("transfertSchema", () => {
  it("accepte un transfert valide", () => {
    expect(transfertSchema.safeParse(base).success).toBe(true);
  });
  it("refuse la même boutique, une liste vide, un produit en double, une quantité invalide", () => {
    const messages = (v: unknown) => {
      const r = transfertSchema.safeParse(v);
      return r.success ? [] : r.error.issues.map((i) => i.message);
    };
    expect(messages({ ...base, destination: base.source })).toContain("Choisissez deux boutiques différentes.");
    expect(messages({ ...base, lignes: [] })).toContain("Ajoutez au moins un produit à transférer.");
    expect(
      messages({ ...base, lignes: [base.lignes[0], base.lignes[0]] }),
    ).toContain("Un produit ne peut figurer qu'une fois dans un transfert.");
    expect(messages({ ...base, lignes: [{ produitId: id(10), quantite: 0 }] })).toContain("La quantité doit être supérieure à zéro.");
    expect(messages({ ...base, lignes: [{ produitId: id(10), quantite: 1.2345 }] })).toContain("Trois décimales au plus.");
    expect(messages({ ...base, cle: "pas-un-uuid" }).length).toBeGreaterThan(0);
  });
});
