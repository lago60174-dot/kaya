import { describe, expect, it } from "vitest";
import {
  formaterStock,
  lireMontant,
  lireQuantite,
  margeUnite,
} from "./quantites";

describe("lireQuantite", () => {
  it.each([
    ["12", 12],
    ["2,5", 2.5],
    ["2.5", 2.5],
    [" 1 250,125 ", 1250.125],
    ["0,02", 0.02],
  ])("%s -> %s", (t, n) => expect(lireQuantite(t)).toBe(n));
  it.each(["", "abc", "1,2345", "-3", "0", "1e3", "1,2,3"])("refuse %j", (t) =>
    expect(lireQuantite(t)).toBeNull(),
  );
  it("accepte zéro seulement si permis", () => {
    expect(lireQuantite("0", { autoriserZero: true })).toBe(0);
  });
});

describe("lireMontant", () => {
  it.each([
    ["5500", 5500],
    ["5 500", 5500],
    ["1 250 000 FCFA", 1250000],
    ["0", 0],
  ])("%s -> %s", (t, n) => expect(lireMontant(t)).toBe(n));
  it.each(["", "12,5", "-5", "cent", "1.5"])("refuse %j", (t) =>
    expect(lireMontant(t)).toBeNull(),
  );
});

describe("formaterStock", () => {
  const unites = [
    { nom: "kg", facteur: 1 },
    { nom: "sac de 50 kg", facteur: 50 },
  ];
  it("affiche l'unité de base et la conversion dans la plus grande unité", () => {
    expect(formaterStock(249, "kg", unites)).toBe(
      "249 kg · 4,98 sacs de 50 kg",
    );
  });
  it("montre 0,02 sac sans erreur d'arrondi après la vente de 1 kg sur 50 kg", () => {
    expect(formaterStock(1, "kg", unites)).toBe("1 kg · 0,02 sac de 50 kg");
    expect(formaterStock(49, "kg", unites)).toBe("49 kg · 0,98 sac de 50 kg");
  });
  it("n'ajoute rien sans unité plus grande", () => {
    expect(formaterStock(12, "barre", [{ nom: "barre", facteur: 1 }])).toBe(
      "12 barres",
    );
    expect(formaterStock(1, "barre", [])).toBe("1 barre");
  });
  it("accorde le premier mot et laisse les abréviations", () => {
    expect(
      formaterStock(30, "kg", [{ nom: "sac de 25 kg", facteur: 25 }]),
    ).toBe("30 kg · 1,2 sac de 25 kg");
    expect(
      formaterStock(300, "mètre", [{ nom: "rouleau de 100 m", facteur: 100 }]),
    ).toBe("300 mètres · 3 rouleaux de 100 m");
    expect(formaterStock(5, "L", [])).toBe("5 L");
  });
  it("gère zéro et le stock négatif", () => {
    expect(formaterStock(0, "kg", unites)).toBe("0 kg · 0 sac de 50 kg");
    expect(formaterStock(-2, "pièce", [])).toBe("-2 pièces");
  });
});

describe("margeUnite", () => {
  it("calcule la marge d'un sac de 50 kg (achat 95 FCFA le kg)", () => {
    expect(margeUnite(5500, 50, 95)).toBe(750);
    expect(margeUnite(130, 1, 95)).toBe(35);
  });
  it("peut être négative (vente à perte)", () => {
    expect(margeUnite(80, 1, 95)).toBe(-15);
  });
});
