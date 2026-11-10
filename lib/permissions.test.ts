import { describe, expect, it } from "vitest";
import {
  accueilPour,
  decisionGarde,
  menuPour,
  roleAutorise,
  zonePourChemin,
  type Role,
} from "./permissions";
import { planDepuisLigne } from "./plans";

const plan = (devis: boolean) =>
  planDepuisLigne({
    code: "x",
    nom: "x",
    prix_mensuel: 1,
    visible_public: true,
    ordre: 1,
    fonctionnalites: { devis, fournisseurs: devis },
    limites: {},
  });

describe("zonePourChemin", () => {
  it.each([
    ["/", "public"],
    ["/connexion", "public"],
    ["/inscription", "public"],
    ["/a/ABCD12", "public"],
    ["/r/jeton", "public"],
    ["/api/webhooks/fapshi", "public"],
    ["/mot-de-passe", "connecte"],
    ["/vente", "boutique"],
    ["/stock/nouveau", "boutique"],
    ["/patron", "proprietaire"],
    ["/parametres/vendeurs", "proprietaire"],
    ["/journal", "proprietaire"],
    ["/admin", "admin"],
    ["/admin/organisations", "admin"],
    ["/affilie", "affilie"],
  ] as const)("%s -> %s", (chemin, zone) =>
    expect(zonePourChemin(chemin)).toBe(zone),
  );

  it("protège par défaut tout chemin inconnu", () => {
    expect(zonePourChemin("/nimporte/quoi")).toBe("boutique");
  });
  it("ne confond pas /patronage avec /patron", () => {
    expect(zonePourChemin("/patronage")).toBe("boutique");
  });
});

describe("roleAutorise : un vendeur n'atteint jamais les écrans du propriétaire", () => {
  it("vendeur", () => {
    expect(roleAutorise("vendeur", "boutique")).toBe(true);
    expect(roleAutorise("vendeur", "proprietaire")).toBe(false);
    expect(roleAutorise("vendeur", "admin")).toBe(false);
  });
  it("propriétaire", () => {
    expect(roleAutorise("proprietaire", "proprietaire")).toBe(true);
    expect(roleAutorise("proprietaire", "admin")).toBe(false);
    expect(roleAutorise("proprietaire", "affilie")).toBe(false);
  });
  it("affilié : uniquement son espace", () => {
    expect(roleAutorise("affilie", "affilie")).toBe(true);
    expect(roleAutorise("affilie", "boutique")).toBe(false);
    expect(roleAutorise("affilie", "proprietaire")).toBe(false);
  });
  it("administrateur : pas d'accès aux écrans d'une boutique", () => {
    expect(roleAutorise("administrateur_plateforme", "admin")).toBe(true);
    expect(roleAutorise("administrateur_plateforme", "boutique")).toBe(false);
  });
  it("visiteur : public seulement", () => {
    expect(roleAutorise(null, "public")).toBe(true);
    expect(roleAutorise(null, "connecte")).toBe(false);
  });
});

describe("decisionGarde", () => {
  const s = (role: Role | null, doit = false) => ({
    role,
    doitChangerMotDePasse: doit,
  });
  it("renvoie un visiteur vers la connexion", () => {
    expect(decisionGarde(null, "boutique")).toEqual({
      type: "rediriger",
      vers: "/connexion",
    });
  });
  it("renvoie un compte sans rôle (désactivé) vers la connexion", () => {
    expect(decisionGarde(s(null), "boutique")).toEqual({
      type: "rediriger",
      vers: "/connexion",
    });
  });
  it("force le changement du mot de passe provisoire partout, sauf sur sa page", () => {
    expect(decisionGarde(s("vendeur", true), "boutique")).toEqual({
      type: "rediriger",
      vers: "/mot-de-passe",
    });
    expect(decisionGarde(s("vendeur", true), "connecte")).toEqual({
      type: "ok",
    });
  });
  it("renvoie un vendeur qui tape une adresse du propriétaire vers son accueil", () => {
    expect(decisionGarde(s("vendeur"), "proprietaire")).toEqual({
      type: "rediriger",
      vers: "/vente",
    });
  });
  it("laisse passer un rôle autorisé et le public", () => {
    expect(decisionGarde(s("proprietaire"), "proprietaire")).toEqual({
      type: "ok",
    });
    expect(decisionGarde(null, "public")).toEqual({ type: "ok" });
  });
});

describe("accueilPour", () => {
  it("un accueil par rôle", () => {
    expect(accueilPour("proprietaire")).toBe("/patron");
    expect(accueilPour("vendeur")).toBe("/vente");
    expect(accueilPour("administrateur_plateforme")).toBe("/admin");
    expect(accueilPour("affilie")).toBe("/affilie");
  });
});

describe("menuPour : pas de bouton verrouillé", () => {
  const libelles = (role: Role, devis: boolean) =>
    menuPour(role, plan(devis)).map((m) => m.libelle);
  it("Essentiel : ni Devis ni Fournisseurs", () => {
    const m = libelles("proprietaire", false);
    expect(m).not.toContain("Devis");
    expect(m).not.toContain("Fournisseurs");
    expect(m).toContain("Paramètres");
  });
  it("un plan avec ces fonctions les affiche", () => {
    expect(libelles("proprietaire", true)).toEqual(
      expect.arrayContaining(["Devis", "Fournisseurs"]),
    );
  });
  it("le vendeur ne voit que les écrans de vente", () => {
    expect(libelles("vendeur", true)).toEqual([
      "Vente",
      "Stock",
      "Clients",
      "Caisse",
    ]);
  });
  it("les rôles de plateforme n'ont pas le menu d'une boutique", () => {
    expect(libelles("affilie", true)).toEqual([]);
  });
});
