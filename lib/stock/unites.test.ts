import { describe, expect, it } from "vitest";
import { suggestionsUnites } from "./unites";

describe("suggestionsUnites", () => {
  it("propose plusieurs conditionnements pour le kg (sacs de 50, 25, 10, 5 kg)", () => {
    expect(suggestionsUnites("kg").map((u) => u.facteur)).toEqual([
      50, 25, 10, 5, 1,
    ]);
  });
  it("ne tient compte ni des accents ni de la casse", () => {
    expect(suggestionsUnites("METRE")[0].nom).toBe("rouleau de 100 m");
    expect(suggestionsUnites(" Pièce ").map((u) => u.nom)).toContain(
      "carton de 12",
    );
  });
  it("donne des noms distincts pour chaque conditionnement", () => {
    const noms = suggestionsUnites("kg").map((u) => u.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });
  it("pour une unité inconnue, propose l'unité elle-même", () => {
    expect(suggestionsUnites("palette")).toEqual([
      { nom: "palette", facteur: 1 },
    ]);
    expect(suggestionsUnites("  ")).toEqual([]);
  });
});
