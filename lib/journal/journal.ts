import { formatFcfa, formatQuantite } from "@/lib/format";
import { libelleCategorie } from "@/lib/caisse/caisse";
import { libelleMode } from "@/lib/ventes/paiements";

export type CategorieJournal =
  "ventes" | "caisse" | "stock" | "credits" | "compte";

export const CATEGORIES_JOURNAL: { code: CategorieJournal; libelle: string }[] =
  [
    { code: "ventes", libelle: "Ventes" },
    { code: "caisse", libelle: "Caisse" },
    { code: "stock", libelle: "Stock" },
    { code: "credits", libelle: "Crédits" },
    { code: "compte", libelle: "Compte" },
  ];

interface DefinitionAction {
  libelle: string;
  categorie: CategorieJournal;
  /** Visible dans le journal de base (plan Essentiel) : ventes, annulations, remises, clôtures. */
  base: boolean;
}

/** Toutes les actions écrites par la base. Doit rester alignée avec la politique RLS du journal (testé). */
export const ACTIONS: Record<string, DefinitionAction> = {
  vente_creee: { libelle: "Vente", categorie: "ventes", base: true },
  vente_annulee: { libelle: "Vente annulée", categorie: "ventes", base: true },
  remise_elevee: { libelle: "Remise élevée", categorie: "ventes", base: true },
  caisse_cloturee: {
    libelle: "Caisse clôturée",
    categorie: "caisse",
    base: true,
  },
  caisse_validee: {
    libelle: "Caisse validée",
    categorie: "caisse",
    base: true,
  },
  depense_enregistree: {
    libelle: "Dépense",
    categorie: "caisse",
    base: false,
  },
  stock_bas: { libelle: "Stock bas", categorie: "stock", base: false },
  stock_negatif: { libelle: "Stock négatif", categorie: "stock", base: false },
  stock_entree: { libelle: "Entrée de stock", categorie: "stock", base: false },
  stock_perte: { libelle: "Perte ou casse", categorie: "stock", base: false },
  stock_inventaire: { libelle: "Inventaire", categorie: "stock", base: false },
  stock_correction: {
    libelle: "Correction de stock",
    categorie: "stock",
    base: false,
  },
  produit_cree: { libelle: "Produit créé", categorie: "stock", base: false },
  produit_modifie: {
    libelle: "Produit modifié",
    categorie: "stock",
    base: false,
  },
  produit_archive: {
    libelle: "Produit archivé",
    categorie: "stock",
    base: false,
  },
  produit_restaure: {
    libelle: "Produit restauré",
    categorie: "stock",
    base: false,
  },
  prix_modifie: { libelle: "Prix modifié", categorie: "stock", base: false },
  remboursement_credit: {
    libelle: "Paiement d'un crédit",
    categorie: "credits",
    base: false,
  },
  credit_force: {
    libelle: "Crédit au-delà du plafond",
    categorie: "credits",
    base: false,
  },
  parametres_modifies: {
    libelle: "Paramètres modifiés",
    categorie: "compte",
    base: false,
  },
  organisation_creee: {
    libelle: "Boutique créée",
    categorie: "compte",
    base: false,
  },
  auto_parrainage_refuse: {
    libelle: "Parrainage refusé",
    categorie: "compte",
    base: false,
  },
};

export const libelleAction = (action: string) =>
  ACTIONS[action]?.libelle ?? "Autre action";

/** Actions visibles selon le plan (journal de base ou complet). */
export function actionsVisibles(complet: boolean): string[] {
  return Object.entries(ACTIONS)
    .filter(([, a]) => complet || a.base)
    .map(([code]) => code);
}

/** Catégories qui contiennent au moins une action visible : le filtre n'en propose pas d'autres. */
export function categoriesVisibles(complet: boolean) {
  const vues = new Set(
    actionsVisibles(complet).map((a) => ACTIONS[a].categorie),
  );
  return CATEGORIES_JOURNAL.filter((c) => vues.has(c.code));
}

export function actionsDeCategorie(
  categorie: CategorieJournal,
  complet: boolean,
): string[] {
  return actionsVisibles(complet).filter(
    (a) => ACTIONS[a].categorie === categorie,
  );
}

type Details = Record<string, unknown>;
const nombre = (v: unknown): number | null => {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const texte = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const fcfa = (v: unknown) => {
  const n = nombre(v);
  return n !== null && Number.isInteger(n) ? formatFcfa(n) : null;
};

/** Phrase lisible pour une ligne du journal. Ne plante jamais, même si les détails sont incomplets. */
export function decrire(action: string, d: Details): string {
  switch (action) {
    case "vente_creee": {
      const credit = nombre(d.credit);
      return `Vente ${texte(d.numero_recu) ?? ""} de ${fcfa(d.total) ?? "?"}${credit ? `, dont ${formatFcfa(credit)} à crédit` : ""}.`.replace(
        "  ",
        " ",
      );
    }
    case "vente_annulee":
      return `Vente ${texte(d.numero_recu) ?? ""} de ${fcfa(d.montant) ?? "?"} annulée (avoir ${texte(d.avoir) ?? "?"}). Motif : ${texte(d.motif) ?? "non précisé"}.`.replace(
        "  ",
        " ",
      );
    case "remise_elevee":
      return `Remise de ${fcfa(d.remise) ?? "?"} (${nombre(d.pourcentage) ?? "?"} %) sur la vente ${texte(d.numero_recu) ?? "?"}.`;
    case "caisse_cloturee": {
      const ecart = nombre(d.ecart);
      const jour = texte(d.date);
      return `Caisse${jour ? ` du ${jour.split("-").reverse().join("/")}` : ""} clôturée : ${fcfa(d.compte) ?? "?"} comptés pour ${fcfa(d.attendu) ?? "?"} attendus${ecart === 0 ? " (caisse juste)" : ecart !== null && Number.isInteger(ecart) ? ` (écart ${formatFcfa(ecart)})` : ""}.`;
    }
    case "caisse_validee":
      return "Caisse validée par le propriétaire.";
    case "depense_enregistree": {
      const mode = texte(d.mode);
      const cat = texte(d.categorie);
      return `Dépense ${cat ? libelleCategorie(cat).toLowerCase() : ""} de ${fcfa(d.montant) ?? "?"}${mode ? ` (${libelleMode(mode)})` : ""}.`.replace(
        "  ",
        " ",
      );
    }
    case "stock_bas":
      return `Stock bas : ${texte(d.produit) ?? "un produit"}, il en reste ${nombre(d.stock) !== null ? formatQuantite(nombre(d.stock) as number) : "?"} (seuil ${nombre(d.seuil) !== null ? formatQuantite(nombre(d.seuil) as number) : "?"}).`;
    case "stock_negatif":
      return `Stock négatif : ${texte(d.produit) ?? "un produit"} vendu au-delà du stock (${nombre(d.stock_avant) !== null ? formatQuantite(nombre(d.stock_avant) as number) : "?"} en stock, ${nombre(d.vendu) !== null ? formatQuantite(nombre(d.vendu) as number) : "?"} vendus).`;
    case "credit_force":
      return `Crédit accordé au-delà du plafond (${fcfa(d.credit) ?? "?"} ajoutés, plafond ${fcfa(d.plafond) ?? "?"}).`;
    case "remboursement_credit": {
      const mode = texte(d.mode);
      return `Paiement de ${fcfa(d.montant) ?? "?"}${mode ? ` (${libelleMode(mode)})` : ""}, reçu ${texte(d.numero) ?? "?"}.`;
    }
    case "stock_entree":
    case "stock_perte":
    case "stock_inventaire":
    case "stock_correction": {
      const q = nombre(d.quantite_base);
      const motif = texte(d.motif);
      return `${libelleAction(action)} : ${q !== null ? `${q > 0 ? "+" : ""}${formatQuantite(q)} en unité de base` : "quantité inconnue"}${motif ? `. Motif : ${motif}` : ""}.`;
    }
    case "produit_cree":
    case "produit_modifie":
    case "prix_modifie":
      return `${libelleAction(action)} : ${texte(d.nom) ?? "un produit"}.`;
    case "produit_archive":
    case "produit_restaure":
      return `${libelleAction(action)}.`;
    case "organisation_creee":
      return "Boutique créée.";
    case "auto_parrainage_refuse":
      return "Parrainage refusé : un compte ne peut pas se parrainer lui-même.";
    default:
      return "Action enregistrée.";
  }
}

/** Lien vers l'élément concerné, quand l'application a un écran pour lui. */
export function lienEntite(
  entite: string | null,
  entiteId: string | null,
  d: Details,
): string | null {
  if (!entite || !entiteId) return null;
  switch (entite) {
    case "vente":
      return `/vente/recu/${entiteId}`;
    case "client":
      return `/clients/${entiteId}`;
    case "produit":
      return `/stock/${entiteId}`;
    case "cloture": {
      const jour = texte(d.date);
      return jour ? `/caisse?date=${jour}` : "/caisse";
    }
    default:
      return null;
  }
}
