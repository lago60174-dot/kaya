import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  lireFiltres,
  actionsFiltrees,
  lienJournal,
  lireCurseur,
} from "./filtres";
import {
  ACTIONS,
  actionsVisibles,
  categoriesVisibles,
  decrire,
  lienEntite,
  libelleAction,
} from "./journal";
import { modeMiseAJour, variationVsHier } from "../patron/direct";

// formatFcfa utilise des espaces insécables (pour ne pas couper « 12 500 FCFA ») : on les compare comme des espaces.
const esp = (t: string) => t.replace(/\u00A0/g, " ");
const sql = (f: string) =>
  readFileSync(join(__dirname, "..", "..", "supabase", f), "utf8");

describe("vocabulaire du journal", () => {
  it("couvre toutes les actions écrites par la base (aucune action sans libellé)", () => {
    // Toutes les migrations : une nouvelle action ne peut plus être oubliée dans une liste figée.
    const dossier = join(__dirname, "..", "..", "supabase", "migrations");
    const code = readdirSync(dossier)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => sql(`migrations/${f}`))
      .join("\n");
    const ecrites = new Set(
      [...code.matchAll(/ecrire_journal\([^']*'([a-z_]+)'/g)]
        .map((m) => m[1])
        .filter((a) => !a.endsWith("_")), // « stock_ » || type : construit plus bas
    );
    // Actions construites dynamiquement : 'stock_' || type, case when ... 'produit_*'.
    for (const a of [
      "stock_entree",
      "stock_perte",
      "stock_inventaire",
      "stock_correction",
      "produit_cree",
      "produit_modifie",
      "produit_archive",
      "produit_restaure",
    ])
      ecrites.add(a);
    for (const a of ecrites)
      expect(ACTIONS, `action « ${a} »`).toHaveProperty(a);
  });

  it("le journal de base correspond exactement à la politique RLS du plan Essentiel", () => {
    const rls = sql("migrations/20260101000005_plateforme.sql");
    const liste = /action in \(([^)]*)\)/.exec(rls)?.[1] ?? "";
    const enBase = [...liste.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(actionsVisibles(false).sort()).toEqual(enBase);
  });

  it("le journal complet montre tout, le journal de base seulement ventes, annulations, remises et clôtures", () => {
    expect(actionsVisibles(true)).toHaveLength(Object.keys(ACTIONS).length);
    expect(actionsVisibles(false)).toEqual([
      "vente_creee",
      "vente_annulee",
      "remise_elevee",
      "caisse_cloturee",
      "caisse_validee",
    ]);
    expect(categoriesVisibles(false).map((c) => c.code)).toEqual([
      "ventes",
      "caisse",
    ]);
    expect(categoriesVisibles(true)).toHaveLength(5);
  });
});

describe("décrire une ligne du journal", () => {
  it("écrit des phrases en français avec des montants formatés", () => {
    const d = (action: string, details: Record<string, unknown>) =>
      esp(decrire(action, details));
    expect(
      d("vente_creee", {
        numero_recu: "R-2026-000012",
        total: 12500,
        credit: 2500,
      }),
    ).toBe("Vente R-2026-000012 de 12 500 FCFA, dont 2 500 FCFA à crédit.");
    expect(
      d("vente_annulee", {
        numero_recu: "R-2026-000012",
        montant: 12500,
        avoir: "A-2026-000001",
        motif: "Erreur de prix",
      }),
    ).toContain("Motif : Erreur de prix.");
    expect(
      d("caisse_cloturee", {
        attendu: 50000,
        compte: 48000,
        ecart: -2000,
        date: "2026-11-12",
      }),
    ).toBe(
      "Caisse du 12/11/2026 clôturée : 48 000 FCFA comptés pour 50 000 FCFA attendus (écart -2 000 FCFA).",
    );
    expect(
      d("stock_bas", { produit: "Ciment · Dangote", stock: 4.5, seuil: 10 }),
    ).toBe("Stock bas : Ciment · Dangote, il en reste 4,5 (seuil 10).");
  });
  it("ne plante jamais sur des détails vides, faux ou d'une action inconnue", () => {
    for (const a of [...Object.keys(ACTIONS), "inconnue"]) {
      expect(() => decrire(a, {})).not.toThrow();
      expect(() =>
        decrire(a, { total: "abc", montant: null, ecart: {} }),
      ).not.toThrow();
      expect(decrire(a, {})).not.toMatch(/undefined|NaN|\[object/);
    }
    expect(libelleAction("inconnue")).toBe("Autre action");
  });
  it("ne rend pas de balise : le texte du motif est une simple chaîne", () => {
    expect(decrire("vente_annulee", { motif: "<script>x</script>" })).toContain(
      "<script>",
    );
    // L'échappement est assuré par React à l'affichage ; ici on vérifie seulement que rien n'est interprété.
  });
  it("lie la ligne à l'écran concerné", () => {
    expect(lienEntite("vente", "abc", {})).toBe("/vente/recu/abc");
    expect(lienEntite("client", "abc", {})).toBe("/clients/abc");
    expect(lienEntite("produit", "abc", {})).toBe("/stock/abc");
    expect(lienEntite("cloture", "abc", { date: "2026-11-12" })).toBe(
      "/caisse?date=2026-11-12",
    );
    expect(lienEntite("affilie", "abc", {})).toBeNull();
    expect(lienEntite(null, null, {})).toBeNull();
  });
});

describe("filtres du journal", () => {
  it("ignore les valeurs invalides ou non permises par le plan", () => {
    expect(lireFiltres({ type: "stock" }, false).categorie).toBeNull();
    expect(lireFiltres({ type: "stock" }, true).categorie).toBe("stock");
    expect(lireFiltres({ type: "n'importe quoi" }, true).categorie).toBeNull();
    expect(lireFiltres({ du: "2026-02-30" }, true).du).toBeNull();
  });
  it("remet une période à l'envers dans l'ordre", () => {
    const f = lireFiltres({ du: "2026-11-12", au: "2026-11-01" }, true);
    expect(f).toMatchObject({ du: "2026-11-01", au: "2026-11-12" });
  });
  it("ne demande à la base que les actions permises", () => {
    const f = lireFiltres({}, false);
    expect(actionsFiltrees(f, false)).toEqual(actionsVisibles(false));
    expect(
      actionsFiltrees(lireFiltres({ type: "caisse" }, false), false),
    ).toEqual(["caisse_cloturee", "caisse_validee"]);
  });
  it("reconstruit les liens avec les filtres et le curseur", () => {
    expect(lienJournal({})).toBe("/journal");
    expect(
      lienJournal(
        { categorie: "ventes", alertesSeulement: true, du: "2026-11-01" },
        { date: "2026-11-12T10:00:00Z", id: 42 },
      ),
    ).toBe(
      "/journal?type=ventes&alertes=1&du=2026-11-01&apres=2026-11-12T10%3A00%3A00Z&id=42",
    );
  });
});

describe("curseur de pagination", () => {
  it("fait l'aller-retour par l'adresse, microsecondes et fuseau « + » compris", () => {
    const curseur = { date: "2026-11-12T10:00:00.123456+00:00", id: 42 };
    const url = new URL(
      lienJournal({ alertesSeulement: true }, curseur),
      "https://kaya.test",
    );
    const p = Object.fromEntries(url.searchParams);
    expect(lireCurseur(p)).toEqual(curseur);
  });
  it("refuse tout ce qui n'est pas une date et un entier (aucune injection possible)", () => {
    expect(lireCurseur({ apres: "x),id.gt.0", id: "1" })).toBeNull();
    expect(
      lireCurseur({ apres: "2026-11-12T10:00:00Z", id: "1; drop" }),
    ).toBeNull();
    expect(lireCurseur({ apres: "2026-11-12T10:00:00Z", id: "-3" })).toBeNull();
    expect(lireCurseur({ apres: "2026-11-12T10:00:00Z" })).toBeNull();
    expect(lireCurseur({})).toBeNull();
  });
});

describe("mise à jour du tableau de bord", () => {
  it("onglet caché : tout est coupé", () => {
    expect(modeMiseAJour({ visible: false, canalConnecte: true })).toBe(
      "arret",
    );
    expect(modeMiseAJour({ visible: false, canalConnecte: false })).toBe(
      "arret",
    );
  });
  it("temps réel connecté : direct ; coupé : repli toutes les 30 s", () => {
    expect(modeMiseAJour({ visible: true, canalConnecte: true })).toBe(
      "direct",
    );
    expect(modeMiseAJour({ visible: true, canalConnecte: false })).toBe(
      "secours",
    );
  });
  it("variation par rapport à hier", () => {
    expect(variationVsHier(150, 100)).toBe(50);
    expect(variationVsHier(50, 100)).toBe(-50);
    expect(variationVsHier(10, 0)).toBeNull();
  });
});
