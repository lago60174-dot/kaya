import { z } from "zod";
import { formatFcfa } from "@/lib/format";
import type { StatutAbonnement } from "@/lib/plans";

const schema = z.object({
  statut: z.enum(["en_attente", "actif", "en_retard", "suspendu", "annule"]),
  prochaine_echeance: z.string().nullable(),
  fin_grace: z.string().nullable(),
  plan_en_attente: z.string().nullable(),
});

export interface EtatAbonnement {
  statut: StatutAbonnement;
  echeance: Date | null;
  finGrace: Date | null;
  planEnAttente: string | null;
}

/** Lecture de `abonnement_statut()` (visible par tout membre de l'organisation). */
export function etatDepuisSql(brut: unknown): EtatAbonnement | null {
  const r = schema.safeParse(brut);
  if (!r.success) return null;
  const d = (v: string | null) => (v ? new Date(v) : null);
  return {
    statut: r.data.statut,
    echeance: d(r.data.prochaine_echeance),
    finGrace: d(r.data.fin_grace),
    planEnAttente: r.data.plan_en_attente,
  };
}

const JOUR = 86_400_000;
/** Jours entiers restants, arrondis au supérieur ; jamais négatif. */
export function joursRestants(cible: Date, maintenant: Date): number {
  return Math.max(
    0,
    Math.ceil((cible.getTime() - maintenant.getTime()) / JOUR),
  );
}
const pluriel = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;
const jour = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Douala",
  }).format(d);

export interface Bandeau {
  ton: "info" | "alerte" | "blocage";
  message: string;
}

/** Message affiché en haut de l'écran. Null : rien à signaler (actif et échéance lointaine). */
export function bandeauAbonnement(
  e: EtatAbonnement,
  maintenant: Date,
): Bandeau | null {
  switch (e.statut) {
    case "en_attente":
      return {
        ton: "info",
        message:
          "Votre abonnement n'est pas encore réglé. Choisissez votre formule et payez pour continuer sans interruption.",
      };
    case "actif":
      return e.echeance && joursRestants(e.echeance, maintenant) <= 3
        ? {
            ton: "info",
            message: `Votre abonnement arrive à échéance le ${jour(e.echeance)}. Réglez-le pour éviter toute interruption.`,
          }
        : null;
    case "en_retard":
      return {
        ton: "alerte",
        message: e.finGrace
          ? `Votre abonnement n'est pas réglé. Il vous reste ${pluriel(joursRestants(e.finGrace, maintenant))} avant la mise en lecture seule.`
          : "Votre abonnement n'est pas réglé.",
      };
    case "suspendu":
      return {
        ton: "blocage",
        message:
          "Votre abonnement est suspendu : l'application est en lecture seule. Vos données sont conservées. Réglez votre abonnement pour reprendre.",
      };
    case "annule":
      return {
        ton: "blocage",
        message:
          "Votre abonnement est annulé : l'application est en lecture seule. Vos données sont conservées.",
      };
  }
}

export const LIBELLE_STATUT: Record<StatutAbonnement, string> = {
  en_attente: "À régler",
  actif: "Actif",
  en_retard: "En retard de paiement",
  suspendu: "Suspendu (lecture seule)",
  annule: "Annulé",
};

/** Texte du bouton de paiement. */
export const libellePaiement = (montant: number) =>
  `Payer ${formatFcfa(montant)}`;

/** Lien public stable envoyé par WhatsApp : il crée un lien Fapshi frais à chaque ouverture (ceux de Fapshi expirent en 24 h). */
export const lienFacture = (urlApp: string, factureId: string) =>
  `${urlApp.replace(/\/$/, "")}/payer/${factureId}`;
