import { describe, expect, it } from "vitest";
import { planDepuisLigne } from "@/lib/plans";
import {
  changerEtatVendeur,
  creerVendeur,
  reinitialiserMotDePasseVendeur,
  type ContexteProprietaire,
  type MembreLu,
  type PortAdmin,
} from "./service";

const plan = planDepuisLigne({
  code: "essentiel",
  nom: "Essentiel",
  prix_mensuel: 5000,
  visible_public: true,
  ordre: 1,
  fonctionnalites: {},
  limites: { vendeurs: 1 },
});
const ctx = (vendeursActifs = 0): ContexteProprietaire => ({
  organisationId: "org-A",
  boutiqueIds: ["b1"],
  plan,
  vendeursActifs,
});
const octets = new Uint8Array(16).fill(7);

function faux(membres: MembreLu[] = []) {
  const journal: string[] = [];
  const port: PortAdmin = {
    async creerUtilisateur(a) {
      journal.push(`creer:${a.email}`);
      return a.email === "pris@x.cm"
        ? { ok: false, emailExiste: true }
        : { ok: true, id: "u-new" };
    },
    async supprimerUtilisateur(id) {
      journal.push(`supprimer:${id}`);
    },
    async insererMembre() {
      journal.push("membre");
      return journal.includes("echec-membre")
        ? { ok: false, message: "Votre abonnement permet 1 vendeur actif." }
        : { ok: true };
    },
    async lireMembre(id) {
      return membres.find((m) => m.id === id) ?? null;
    },
    async mettreAJourActif(id, actif) {
      journal.push(`actif:${id}:${actif}`);
      return { ok: true };
    },
    async definirBlocage(id, bloque) {
      journal.push(`blocage:${id}:${bloque}`);
    },
    async definirMotDePasseProvisoire(id) {
      journal.push(`mdp:${id}`);
    },
  };
  return { port, journal };
}
const vendeur = (extra: Partial<MembreLu> = {}): MembreLu => ({
  id: "m1",
  utilisateurId: "u1",
  organisationId: "org-A",
  role: "vendeur",
  actif: true,
  ...extra,
});

describe("creerVendeur", () => {
  it("crée le compte avec un mot de passe provisoire à afficher une seule fois", async () => {
    const { port, journal } = faux();
    const r = await creerVendeur(
      port,
      ctx(),
      { nom: "Paul", email: "Paul@X.cm" },
      octets,
    );
    expect(r).toMatchObject({ ok: true, email: "paul@x.cm" });
    expect(r.ok && r.motDePasseProvisoire).toHaveLength(10);
    expect(journal).toEqual(["creer:paul@x.cm", "membre"]);
  });
  it("refuse au-delà de la limite du plan sans rien créer", async () => {
    const { port, journal } = faux();
    const r = await creerVendeur(
      port,
      ctx(1),
      { nom: "Paul", email: "p@x.cm" },
      octets,
    );
    expect(r).toEqual({
      ok: false,
      erreur:
        "Votre abonnement permet 1 vendeur actif. Désactivez un vendeur pour en ajouter un autre.",
    });
    expect(journal).toEqual([]);
  });
  it("signale les champs invalides", async () => {
    const r = await creerVendeur(
      faux().port,
      ctx(),
      { nom: "P", email: "x" },
      octets,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.champs ?? {})).toEqual(["nom", "email"]);
  });
  it("signale un email déjà utilisé", async () => {
    const r = await creerVendeur(
      faux().port,
      ctx(),
      { nom: "Paul", email: "pris@x.cm" },
      octets,
    );
    expect(r).toEqual({
      ok: false,
      erreur: "Cette adresse email est déjà utilisée.",
    });
  });
  it("supprime le compte créé si l'ajout à la boutique échoue (pas de compte orphelin)", async () => {
    const { port, journal } = faux();
    journal.push("echec-membre");
    const r = await creerVendeur(
      port,
      ctx(),
      { nom: "Paul", email: "p@x.cm" },
      octets,
    );
    expect(r.ok).toBe(false);
    expect(journal).toContain("supprimer:u-new");
  });
});

describe("changerEtatVendeur", () => {
  it("désactive un vendeur et bloque sa connexion", async () => {
    const { port, journal } = faux([vendeur()]);
    expect(await changerEtatVendeur(port, ctx(1), "m1", false)).toEqual({
      ok: true,
    });
    expect(journal).toEqual(["actif:m1:false", "blocage:u1:true"]);
  });
  it("réactive seulement si la limite le permet", async () => {
    const { port, journal } = faux([vendeur({ actif: false })]);
    expect((await changerEtatVendeur(port, ctx(1), "m1", true)).ok).toBe(false);
    expect(journal).toEqual([]);
    expect(await changerEtatVendeur(port, ctx(0), "m1", true)).toEqual({
      ok: true,
    });
    expect(journal).toContain("blocage:u1:false");
  });
  it("ne touche jamais à un vendeur d'une autre organisation ni à un propriétaire", async () => {
    const { port, journal } = faux([
      vendeur({ id: "autre", organisationId: "org-B" }),
      vendeur({ id: "patron", role: "proprietaire" }),
    ]);
    for (const id of ["autre", "patron", "inexistant"]) {
      expect(await changerEtatVendeur(port, ctx(), id, false)).toEqual({
        ok: false,
        erreur: "Vendeur introuvable.",
      });
    }
    expect(journal).toEqual([]);
  });
});

describe("reinitialiserMotDePasseVendeur", () => {
  it("génère un nouveau mot de passe provisoire", async () => {
    const { port, journal } = faux([vendeur()]);
    const r = await reinitialiserMotDePasseVendeur(port, ctx(), "m1", octets);
    expect(r.ok && r.motDePasseProvisoire).toHaveLength(10);
    expect(journal).toEqual(["mdp:u1"]);
  });
  it("refuse un compte d'une autre organisation", async () => {
    const { port, journal } = faux([vendeur({ organisationId: "org-B" })]);
    expect(
      await reinitialiserMotDePasseVendeur(port, ctx(), "m1", octets),
    ).toEqual({ ok: false, erreur: "Vendeur introuvable." });
    expect(journal).toEqual([]);
  });
});
