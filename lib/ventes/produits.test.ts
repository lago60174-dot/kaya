import { describe, expect, it } from "vitest";
import { versProduitsVente } from "./produits";

const ligne = (extra = {}) => ({
  id: "p1",
  nom_affiche: "Ciment CPJ 42,5 · Dangote",
  unite_base: "kg",
  stock: "249.000",
  actif: true,
  unites: [
    { id: "u1", nom: "sac de 50 kg", facteur: "50.000", prix_vente: "5500" },
  ],
  ...extra,
});

describe("versProduitsVente", () => {
  it("convertit les nombres reçus en texte et garde la marque dans le nom", () => {
    expect(versProduitsVente([ligne()])).toEqual([
      {
        id: "p1",
        nom: "Ciment CPJ 42,5 · Dangote",
        uniteBase: "kg",
        stock: 249,
        unites: [
          { id: "u1", nom: "sac de 50 kg", facteur: 50, prixVente: 5500 },
        ],
      },
    ]);
  });
  it("écarte les produits hors vente ou sans unité", () => {
    expect(
      versProduitsVente([ligne({ actif: false }), ligne({ unites: [] })]),
    ).toEqual([]);
  });
});
