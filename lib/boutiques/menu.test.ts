import { describe, expect, it } from "vitest";
import { accueilPour, decisionGarde, menuPour } from "@/lib/permissions";
import { planDepuisLigne } from "@/lib/plans";

const plan = (code: string, multi: boolean) =>
  planDepuisLigne({
    code,
    nom: code,
    prix_mensuel: 5000,
    fonctionnalites: { multi_boutiques: multi },
    limites: { vendeurs: 1, boutiques: multi ? null : 1 },
    visible_public: true,
    ordre: 1,
  });

describe("menu « Boutiques »", () => {
  it("n'existe que pour un propriétaire dont le plan permet plusieurs boutiques", () => {
    const liens = (r: "proprietaire" | "vendeur", p: ReturnType<typeof plan>) =>
      menuPour(r, p).map((m) => m.href);
    expect(liens("proprietaire", plan("business", true))).toContain("/boutiques");
    expect(liens("proprietaire", plan("essentiel", false))).not.toContain("/boutiques");
    expect(liens("vendeur", plan("business", true))).not.toContain("/boutiques");
  });

  it("la page est réservée au propriétaire même en tapant l'adresse à la main", () => {
    const vendeur = {
      role: "vendeur" as const,
      organisationId: "o",
      boutiqueIds: ["b"],
    };
    const d = decisionGarde(vendeur as never, "proprietaire");
    expect(d).toEqual({ type: "rediriger", vers: accueilPour("vendeur") });
  });
});
