/**
 * Garde pendant `dureeMs` le dernier résultat réussi d'une lecture (par instance du serveur).
 * Un échec (`null`) n'est jamais gardé : la visite suivante réessaie.
 */
export function avecCache<T>(
  dureeMs: number,
  lire: () => Promise<T | null>,
  maintenant: () => number = Date.now,
): () => Promise<T | null> {
  let garde: { valeur: T; expire: number } | null = null;
  return async () => {
    if (garde && maintenant() < garde.expire) return garde.valeur;
    const valeur = await lire();
    if (valeur !== null) garde = { valeur, expire: maintenant() + dureeMs };
    return valeur;
  };
}
