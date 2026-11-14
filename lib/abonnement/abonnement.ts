export type StatutAbonnement =
  "essai" | "actif" | "en_retard" | "suspendu" | "annule";

export interface EtatAbonnement {
  libelle: string;
  /** Ton du message : sert à choisir la couleur, jamais à cacher le texte. */
  ton: "normal" | "attention" | "bloquant";
  message: string;
}

const MS_JOUR = 86_400_000;

/** Jours restants jusqu'à une date (0 si c'est aujourd'hui, négatif si dépassée), en jours calendaires de Douala. */
export function joursRestants(
  echeance: string | Date,
  maintenant: Date,
): number {
  const jour = (d: Date) => Math.floor((d.getTime() + 3_600_000) / MS_JOUR); // Douala = UTC+1, sans heure d'été
  return jour(new Date(echeance)) - jour(maintenant);
}

export function libelleJours(n: number): string {
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n > 1) return `dans ${n} jours`;
  if (n === -1) return "hier";
  return `il y a ${-n} jours`;
}

/** Message clair sur l'état du compte. Les dates arrivent de la base ; `maintenant` est injecté pour les tests. */
export function etatAbonnement(
  a: {
    statut: StatutAbonnement;
    prochaineEcheance: string | null;
    finEssai: string | null;
    finGrace: string | null;
  },
  maintenant: Date,
): EtatAbonnement {
  switch (a.statut) {
    case "essai": {
      if (!a.finEssai)
        return {
          libelle: "Essai gratuit",
          ton: "normal",
          message: "Vous êtes en période d'essai.",
        };
      const n = joursRestants(a.finEssai, maintenant);
      return {
        libelle: "Essai gratuit",
        ton: n <= 3 ? "attention" : "normal",
        message:
          n < 0
            ? "Votre essai est terminé."
            : `Votre essai gratuit se termine ${libelleJours(n)}.`,
      };
    }
    case "actif": {
      if (!a.prochaineEcheance)
        return {
          libelle: "Actif",
          ton: "normal",
          message: "Votre abonnement est actif.",
        };
      const n = joursRestants(a.prochaineEcheance, maintenant);
      return {
        libelle: "Actif",
        ton: n <= 3 && n >= 0 ? "attention" : "normal",
        message: `Prochaine échéance ${libelleJours(n)}.`,
      };
    }
    case "en_retard": {
      const fin = a.finGrace ? joursRestants(a.finGrace, maintenant) : null;
      return {
        libelle: "Paiement en retard",
        ton: "attention",
        message:
          fin !== null && fin >= 0
            ? `Réglez votre abonnement ${libelleJours(fin)} au plus tard pour ne pas passer en lecture seule.`
            : "Réglez votre abonnement pour continuer à enregistrer vos ventes.",
      };
    }
    case "suspendu":
      return {
        libelle: "Suspendu",
        ton: "bloquant",
        message:
          "Votre compte est en lecture seule : vous pouvez tout consulter, mais plus rien enregistrer. Réglez votre abonnement pour le rouvrir.",
      };
    case "annule":
      return {
        libelle: "Annulé",
        ton: "bloquant",
        message:
          "Votre abonnement est annulé. Vos données restent consultables.",
      };
  }
}

export const LIBELLE_STATUT_FACTURE: Record<string, string> = {
  a_payer: "À payer",
  payee: "Payée",
  annulee: "Annulée",
};
