import { z } from "zod";

/** Où le propriétaire veut recevoir une alerte. `resume` : résumé WhatsApp du soir (réservé aux alertes qui comptent). */
export interface Canaux {
  app: boolean;
  push: boolean;
  resume: boolean;
}

export type CategorieAlerte = "stock" | "finances" | "ventes";

export interface DefinitionAlerte {
  type: string;
  libelle: string;
  aide: string;
  categorie: CategorieAlerte;
  /** Alerte critique : activée partout par défaut, seule à figurer dans le résumé WhatsApp si on le souhaite. */
  critique: boolean;
  defaut: Canaux;
}

export const CATEGORIES_ALERTE: { code: CategorieAlerte; libelle: string }[] = [
  { code: "stock", libelle: "Stock" },
  { code: "finances", libelle: "Argent et caisse" },
  { code: "ventes", libelle: "Ventes" },
];

/** Alertes écrites par la base (journal). Le type est le nom de l'action du journal. */
export const ALERTES: DefinitionAlerte[] = [
  {
    type: "stock_bas",
    libelle: "Stock bas",
    aide: "Un produit passe sous son seuil d'alerte (réglé sur la fiche de chaque produit).",
    categorie: "stock",
    critique: false,
    defaut: { app: true, push: true, resume: false },
  },
  {
    type: "stock_negatif",
    libelle: "Stock négatif",
    aide: "Une vente a été faite sans stock suffisant.",
    categorie: "stock",
    critique: true,
    defaut: { app: true, push: true, resume: true },
  },
  {
    type: "caisse_cloturee",
    libelle: "Écart de caisse",
    aide: "La clôture dépasse l'écart toléré (réglé dans Paramètres).",
    categorie: "finances",
    critique: true,
    defaut: { app: true, push: true, resume: true },
  },
  {
    type: "credit_force",
    libelle: "Crédit au-delà du plafond",
    aide: "Un crédit a été accordé au-dessus du plafond du client (plafond réglé dans Paramètres).",
    categorie: "finances",
    critique: true,
    defaut: { app: true, push: true, resume: true },
  },
  {
    type: "vente_annulee",
    libelle: "Vente annulée",
    aide: "Une vente a été annulée par un avoir.",
    categorie: "ventes",
    critique: true,
    defaut: { app: true, push: true, resume: true },
  },
  {
    type: "remise_elevee",
    libelle: "Remise élevée",
    aide: "Un vendeur accorde plus de la moitié de la remise autorisée (seuil réglé dans Paramètres).",
    categorie: "ventes",
    critique: false,
    defaut: { app: true, push: false, resume: false },
  },
];

const PAR_TYPE = new Map(ALERTES.map((a) => [a.type, a]));

export type Surcharges = Record<string, Partial<Canaux>>;

/** Canaux réellement actifs pour un type : le choix du propriétaire, sinon la valeur par défaut. Un type inconnu reste dans l'app. */
export function canauxEffectifs(type: string, surcharges: Surcharges): Canaux {
  const def = PAR_TYPE.get(type)?.defaut ?? {
    app: true,
    push: false,
    resume: false,
  };
  const s = surcharges[type] ?? {};
  return {
    app: s.app ?? def.app,
    push: s.push ?? def.push,
    resume: s.resume ?? def.resume,
  };
}

/** Réglages envoyés par le formulaire : un type connu, trois cases à cocher. Tout le reste est ignoré. */
export const preferencesSchema = z.record(
  z.string(),
  z.object({
    app: z.boolean(),
    push: z.boolean(),
    resume: z.boolean(),
  }),
);

export function nettoyerPreferences(brut: unknown): Surcharges {
  const lu = preferencesSchema.safeParse(brut);
  if (!lu.success) return {};
  const propre: Surcharges = {};
  for (const [type, canaux] of Object.entries(lu.data))
    if (PAR_TYPE.has(type)) propre[type] = canaux;
  return propre;
}
