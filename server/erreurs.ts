const GENERIQUE = "L'opération a échoué. Réessayez dans un instant.";

/** Message affichable pour une erreur Supabase : les erreurs levées par nos fonctions SQL sont déjà en français. */
export function messageErreurBase(
  erreur: { code?: string; message?: string } | null | undefined,
): string {
  if (!erreur) return GENERIQUE;
  if (erreur.code === "P0001" && erreur.message) return erreur.message;
  if (erreur.code === "23505")
    return "Cet élément existe déjà (un nom est utilisé deux fois).";
  return GENERIQUE;
}
