import { describe, expect, it } from "vitest";
import {
  ecritureAutorisee,
  limite,
  peutUtiliser,
  planDepuisLigne,
  plansVisibles,
  verifierLimite,
  type Plan,
} from "./plans";

const ligne = (code: string, extra: Record<string, unknown> = {}) => ({
  code,
  nom: code,
  prix_mensuel: "5000",
  visible_public: false,
  ordre: 1,
  fonctionnalites: { devis: false, impression: false },
  limites: { vendeurs: 1, boutiques: 1 },
  ...extra,
});
const essentiel: Plan = planDepuisLigne(
  ligne("essentiel", { visible_public: true }),
);
const business: Plan = planDepuisLigne(
  ligne("business", {
    ordre: 3,
    fonctionnalites: { devis: true, impression: true },
    limites: { vendeurs: null, boutiques: null },
  }),
);

describe("planDepuisLigne", () => {
  it("convertit une ligne SQL (prix en texte compris)", () => {
    expect(essentiel.prixMensuel).toBe(5000);
    expect(essentiel.visiblePublic).toBe(true);
  });
  it("refuse une ligne invalide", () => {
    expect(() => planDepuisLigne({ code: "x" })).toThrow();
  });
});

describe("peutUtiliser", () => {
  it("n'accorde que ce que le plan contient", () => {
    expect(peutUtiliser(essentiel, "devis")).toBe(false);
    expect(peutUtiliser(business, "devis")).toBe(true);
  });
  it("refuse une fonction absente du plan", () => {
    expect(peutUtiliser(essentiel, "multi_boutiques")).toBe(false);
  });
});

describe("limite et verifierLimite", () => {
  it("lit les limites, null = illimité, clé absente = 0", () => {
    expect(limite(essentiel, "vendeurs")).toBe(1);
    expect(limite(business, "vendeurs")).toBeNull();
    expect(limite({ ...essentiel, limites: {} }, "boutiques")).toBe(0);
  });
  it("accepte sous la limite, refuse à la limite avec un message clair", () => {
    expect(verifierLimite(essentiel, "vendeurs", 0)).toEqual({ ok: true });
    const r = verifierLimite(essentiel, "vendeurs", 1);
    expect(r).toEqual({
      ok: false,
      message:
        "Votre abonnement permet 1 vendeur actif. Désactivez un vendeur pour en ajouter un autre.",
    });
  });
  it("n'incite pas à changer de plan et accorde le pluriel", () => {
    const pro = { ...essentiel, limites: { vendeurs: 3 } };
    const r = verifierLimite(pro, "vendeurs", 3);
    expect(r.ok === false && r.message).toContain("3 vendeurs actifs");
    expect(r.ok === false && r.message).not.toMatch(
      /plan supérieur|passez|upgrade/i,
    );
  });
  it("ne limite jamais un plan illimité", () => {
    expect(verifierLimite(business, "vendeurs", 500)).toEqual({ ok: true });
  });
  it("limite les boutiques", () => {
    expect(verifierLimite(essentiel, "boutiques", 1)).toEqual({
      ok: false,
      message: "Votre abonnement permet 1 boutique.",
    });
  });
});

describe("plansVisibles", () => {
  it("n'expose que les plans visibles, dans l'ordre", () => {
    expect(plansVisibles([business, essentiel]).map((p) => p.code)).toEqual([
      "essentiel",
    ]);
    expect(
      plansVisibles([{ ...business, visiblePublic: true }, essentiel]).map(
        (p) => p.code,
      ),
    ).toEqual(["essentiel", "business"]);
  });
});

describe("ecritureAutorisee", () => {
  it.each([
    ["essai", true],
    ["actif", true],
    ["en_retard", true],
    ["suspendu", false],
    ["annule", false],
  ] as const)("%s -> %s", (statut, attendu) =>
    expect(ecritureAutorisee(statut)).toBe(attendu),
  );
});
