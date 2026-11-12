import { describe, expect, it } from "vitest";
import { recuPublicDepuisJson } from "./recu";

const json = {
  numero_recu: "R-2026-000003",
  date: "2026-11-10T13:30:00+00:00",
  annule: false,
  remise: 0,
  total: "3730",
  boutique: {
    nom: "Boutique A",
    adresse: null,
    telephone: null,
    mention_legale: "Merci",
  },
  client_nom: "Jean Mbarga",
  lignes: [
    {
      nom: "Clous 3 pouces",
      unite: "kg",
      quantite: "3.000",
      prix_unitaire: 1200,
      remise_ligne: 0,
      total: 3600,
    },
  ],
  paiements: [{ mode: "especes", montant: 500 }],
  credit: 3230,
};

describe("recuPublicDepuisJson", () => {
  it("convertit la réponse SQL en reçu affichable, nombres en texte compris", () => {
    const r = recuPublicDepuisJson(json);
    expect(r).toMatchObject({
      numeroRecu: "R-2026-000003",
      total: 3730,
      credit: 3230,
      boutique: { mentionLegale: "Merci" },
    });
    expect(r.lignes[0]).toMatchObject({ quantite: 3, prixUnitaire: 1200 });
    expect(r.client).toEqual({ nom: "Jean Mbarga", telephone: null });
  });
  it("ne reporte aucun numéro de téléphone du client", () => {
    expect(JSON.stringify(recuPublicDepuisJson(json))).not.toMatch(/\d{9}/);
  });
  it("refuse une réponse dont la forme a changé", () => {
    expect(() => recuPublicDepuisJson({ numero_recu: "x" })).toThrow();
    expect(() => recuPublicDepuisJson(null)).toThrow();
  });
});
