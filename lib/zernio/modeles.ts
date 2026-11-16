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
