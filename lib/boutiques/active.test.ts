import { describe, expect, it } from "vitest";
import { choisirBoutiqueActive, lireBoutiquesAccessibles } from "./active";

describe("choisirBoutiqueActive", () => {
  const ids = ["a", "b", "c"];
  it("garde la boutique choisie si elle est accessible", () => {
    expect(choisirBoutiqueActive("b", ids)).toBe("b");
  });
  it("retombe sur la première boutique si le choix est absent, périmé ou étranger", () => {
    expect(choisirBoutiqueActive(undefined, ids)).toBe("a");
    expect(choisirBoutiqueActive(null, ids)).toBe("a");
    expect(choisirBoutiqueActive("", ids)).toBe("a");
    expect(choisirBoutiqueActive("autre-organisation", ids)).toBe("a");
  });
  it("ne renvoie rien quand l'utilisateur n'a aucune boutique", () => {
    expect(choisirBoutiqueActive("a", [])).toBeUndefined();
  });
});

describe("lireBoutiquesAccessibles", () => {
  it("lit les lignes valides et ignore le reste", () => {
    const r = lireBoutiquesAccessibles([
      { id: "1", nom: "Centre", adresse: "Rue 1", telephone: null, en_ecriture: true },
      { id: "2", nom: "Bastos", en_ecriture: false },
      { nom: "sans id" },
      null,
      "n'importe quoi",
    ]);
    expect(r).toEqual([
      { id: "1", nom: "Centre", adresse: "Rue 1", telephone: null, enEcriture: true },
      { id: "2", nom: "Bastos", adresse: null, telephone: null, enEcriture: false },
    ]);
  });
  it("renvoie une liste vide si la réponse n'est pas une liste", () => {
    expect(lireBoutiquesAccessibles(null)).toEqual([]);
    expect(lireBoutiquesAccessibles({})).toEqual([]);
  });
});
