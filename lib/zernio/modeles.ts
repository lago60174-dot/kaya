import { formatFcfa } from "@/lib/format";

/**
 * Messages WhatsApp d'abonnement. WhatsApp impose des modèles (templates) approuvés par Meta, catégorie « utilitaire » :
 * seules les variables changent. Les textes à faire approuver sont dans docs/WHATSAPP_TEMPLATES.md.
 */
export type EtapeRelance = "j-3" | "j" | "j+2" | "j+5";

export const MODELES: Record<EtapeRelance, string> = {
  "j-3": "kaya_abonnement_rappel",
  j: "kaya_abonnement_echeance",
  "j+2": "kaya_abonnement_retard",
  "j+5": "kaya_abonnement_dernier_jour",
};
export const LANGUE_MODELES = "fr";

export interface DonneesRelance {
  boutique: string;
  montant: number;
  echeance: Date;
  lien: string;
}

const dateCourte = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Douala",
  }).format(d);

/** Variables numérotées {{1}} à {{4}} du modèle : boutique, montant, date d'échéance, lien de paiement. */
export function variablesRelance(d: DonneesRelance): Record<string, string> {
  return {
    "1":
      d.boutique.replace(/\s+/g, " ").trim().slice(0, 60) || "votre boutique",
    "2": formatFcfa(d.montant).replace(/ /g, " "),
    "3": dateCourte(d.echeance),
    "4": d.lien,
  };
}

/** Numéro camerounais au format international : 699000000 -> +237699000000. Null si invalide. */
export function telephoneInternational(brut: string): string | null {
  const chiffres = brut.replace(/[\s().-]/g, "");
  if (/^\+237[26]\d{8}$/.test(chiffres)) return chiffres;
  if (/^237[26]\d{8}$/.test(chiffres)) return `+${chiffres}`;
  if (/^00237[26]\d{8}$/.test(chiffres)) return `+${chiffres.slice(2)}`;
  if (/^[26]\d{8}$/.test(chiffres)) return `+237${chiffres}`;
  return null;
}

/** Résumé quotidien : un seul modèle (texte dans docs/WHATSAPP_TEMPLATES.md). */
export const MODELE_RESUME = "kaya_resume_quotidien";

export interface DonneesResume {
  boutique: string;
  jour: Date;
  ventesTotal: number;
  nbVentes: number;
  produitPhare: string | null;
  stockBas: number;
  credits: number;
}

/** Variables {{1}} à {{6}} : boutique, date, ventes, nombre de ventes, produit phare, points à surveiller. */
export function variablesResume(d: DonneesResume): Record<string, string> {
  const alertes = [
    d.stockBas > 0 ? `${d.stockBas} produit${d.stockBas > 1 ? "s" : ""} en stock bas` : null,
    d.credits > 0 ? `${formatFcfa(d.credits).replace(/ /g, " ")} de crédits clients` : null,
  ].filter(Boolean);
  return {
    "1": d.boutique.replace(/\s+/g, " ").trim().slice(0, 60) || "votre boutique",
    "2": dateCourte(d.jour),
    "3": formatFcfa(d.ventesTotal).replace(/ /g, " "),
    "4": `${d.nbVentes} vente${d.nbVentes > 1 ? "s" : ""}`,
    "5": (d.produitPhare ?? "aucun").replace(/\s+/g, " ").trim().slice(0, 60),
    "6": alertes.length ? alertes.join(" · ") : "rien à signaler",
  };
}
