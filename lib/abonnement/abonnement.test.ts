import { describe, expect, it } from "vitest";
import { etatAbonnement, joursRestants, libelleJours } from "./abonnement";

const nul = { prochaineEcheance: null, finEssai: null, finGrace: null };

describe("joursRestants (jours calendaires de Douala)", () => {
  it("compte en jours calendaires, pas en tranches de 24 h", () => {
    // 23:30 UTC le 10 = 00:30 à Douala le 11 ; l'échéance du 12 à midi est dans 1 jour.
    expect(
      joursRestants("2026-11-12T12:00:00Z", new Date("2026-11-10T23:30:00Z")),
    ).toBe(1);
    expect(
      joursRestants("2026-11-10T08:00:00Z", new Date("2026-11-10T20:00:00Z")),
    ).toBe(0);
    expect(
      joursRestants("2026-11-09T12:00:00Z", new Date("2026-11-10T12:00:00Z")),
    ).toBe(-1);
  });
  it("formule les jours en français", () => {
    expect(libelleJours(0)).toBe("aujourd'hui");
    expect(libelleJours(1)).toBe("demain");
    expect(libelleJours(5)).toBe("dans 5 jours");
    expect(libelleJours(-1)).toBe("hier");
    expect(libelleJours(-4)).toBe("il y a 4 jours");
  });
});

describe("etatAbonnement", () => {
  const maintenant = new Date("2026-11-10T12:00:00Z");
  it("essai : alerte dans les 3 derniers jours", () => {
    expect(
      etatAbonnement(
        { ...nul, statut: "essai", finEssai: "2026-11-20T12:00:00Z" },
        maintenant,
      ),
    ).toMatchObject({
      ton: "normal",
      message: "Votre essai gratuit se termine dans 10 jours.",
    });
    expect(
      etatAbonnement(
        { ...nul, statut: "essai", finEssai: "2026-11-12T12:00:00Z" },
        maintenant,
      ).ton,
    ).toBe("attention");
    expect(
      etatAbonnement(
        { ...nul, statut: "essai", finEssai: "2026-11-01T12:00:00Z" },
        maintenant,
      ).message,
    ).toBe("Votre essai est terminé.");
  });
  it("actif : prochaine échéance", () => {
    expect(
      etatAbonnement(
        { ...nul, statut: "actif", prochaineEcheance: "2026-11-11T12:00:00Z" },
        maintenant,
      ),
    ).toMatchObject({
      ton: "attention",
      message: "Prochaine échéance demain.",
    });
    expect(
      etatAbonnement(
        { ...nul, statut: "actif", prochaineEcheance: "2026-12-10T12:00:00Z" },
        maintenant,
      ).ton,
    ).toBe("normal");
  });
  it("en retard : indique la fin du délai de grâce", () => {
    const e = etatAbonnement(
      { ...nul, statut: "en_retard", finGrace: "2026-11-13T12:00:00Z" },
      maintenant,
    );
    expect(e.ton).toBe("attention");
    expect(e.message).toContain("dans 3 jours");
  });
  it("suspendu et annulé : lecture seule, ton bloquant, données consultables", () => {
    expect(
      etatAbonnement({ ...nul, statut: "suspendu" }, maintenant),
    ).toMatchObject({ ton: "bloquant", libelle: "Suspendu" });
    expect(
      etatAbonnement({ ...nul, statut: "annule" }, maintenant).message,
    ).toContain("consultables");
  });
});
