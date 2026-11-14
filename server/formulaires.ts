import "server-only";
import type { z } from "zod";

/** État renvoyé par les formulaires publics (connexion, inscription, partenaire). */
export interface EtatFormulaire {
  erreur?: string;
  champs?: Record<string, string>;
}

export const ERREUR_GENERIQUE =
  "Une erreur est survenue. Réessayez dans un instant.";

export function champsEnErreur(erreur: z.ZodError): EtatFormulaire {
  const champs: Record<string, string> = {};
  for (const i of erreur.issues) champs[String(i.path[0])] ??= i.message;
  return { erreur: "Vérifiez les champs en rouge.", champs };
}
