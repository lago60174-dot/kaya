import { describe, expect, it } from "vitest";
import { filtresDepuisParametres, libelleStatut } from "./historique";

const ID = "11111111-1111-4111-8111-111111111111";

describe("filtresDepuisParametres", () => {
  it("lit des paramètres valides", () => {
    expect(
      filtresDepuisParametres({
        q: "  mbarga ",
        statut: "annulee",
        vendeur: ID,
        du: "2026-11-01",
        au: "2026-11-30",
      }),
    ).toEqual({
      recherche: "mbarga",
      statut: "annulee",
      vendeur: ID,
      du: "2026-11-01",
      au: "2026-11-30",
    });
  });
  it("ignore tout ce qui est invalide au lieu de planter", () => {
    expect(
      filtresDepuisParametres({
        statut: "'; drop table ventes;--",
        vendeur: "abc",
        du: "demain",
        au: "2026-13-45",
        q: "   ",
      }),
    ).toEqual({
      recherche: undefined,
      statut: undefined,
      vendeur: undefined,
      du: undefined,
      au: undefined,
    });
  });
  it("ne garde le curseur que s'il est complet", () => {
    expect(
      filtresDepuisParametres({
        apres_date: "2026-11-10T13:30:00+00:00",
        apres_id: ID,
      }),
    ).toMatchObject({ apresDate: "2026-11-10T13:30:00+00:00", apresId: ID });
    expect(
      filtresDepuisParametres({ apres_date: "2026-11-10T13:30:00+00:00" }),
    ).not.toHaveProperty("apresDate");
    expect(
      filtresDepuisParametres({ apres_date: "pas une date", apres_id: ID }),
    ).not.toHaveProperty("apresId");
  });
  it("limite la longueur de la recherche", () => {
    expect(
      filtresDepuisParametres({ q: "a".repeat(500) }).recherche,
    ).toHaveLength(60);
  });
});

describe("libelleStatut", () => {
  it("donne des libellés en français", () => {
    expect(libelleStatut("annulee")).toBe("Annulé");
    expect(libelleStatut("valide")).toBe("Valide");
  });
});
