import { describe, expect, it } from "vitest";
import type { Plan } from "@/lib/plans";
import { accesImpression } from "./acces";

const plan = (impression: boolean): Plan => ({
  code: "x",
  nom: "X",
  prixMensuel: 0,
  fonctionnalites: { impression },
  limites: {},
  visiblePublic: true,
  ordre: 1,
});

describe("accesImpression", () => {
  it("accepte un propriétaire ou un vendeur dont le plan inclut l'impression", () => {
    for (const role of ["proprietaire", "vendeur"] as const)
      expect(accesImpression({ role, plan: plan(true) })).toEqual({ ok: true });
  });
  it("refuse (403) un plan sans impression, même pour le propriétaire", () => {
    const r = accesImpression({ role: "proprietaire", plan: plan(false) });
    expect(r).toMatchObject({ ok: false, statut: 403 });
    expect(accesImpression({ role: "vendeur", plan: null })).toMatchObject({
      statut: 403,
    });
  });
  it("refuse (401) un visiteur, un compte désactivé, un affilié et l'administrateur", () => {
    expect(accesImpression(null)).toMatchObject({ statut: 401 });
    for (const role of [null, "affilie", "administrateur_plateforme"] as const)
      expect(accesImpression({ role, plan: plan(true) })).toMatchObject({
        statut: 401,
      });
  });
});
