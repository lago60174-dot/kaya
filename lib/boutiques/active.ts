/** Boutique accessible à l'utilisateur connecté (déjà filtrée par la base selon son rôle). */
export interface BoutiqueAccessible {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  /** Faux quand la boutique dépasse le plan de l'abonnement : consultable, plus modifiable. */
  enEcriture: boolean;
}

/** Nom du cookie qui retient la boutique choisie. Un simple repère : le serveur le revérifie à chaque requête. */
export const COOKIE_BOUTIQUE = "kaya_boutique";

/**
 * Boutique dans laquelle l'utilisateur travaille : celle qu'il a choisie si elle lui est toujours accessible,
 * sinon la première (la plus ancienne). Un identifiant inconnu, périmé ou d'une autre organisation est ignoré.
 */
export function choisirBoutiqueActive(
  demandee: string | null | undefined,
  accessibles: readonly string[],
): string | undefined {
  if (demandee && accessibles.includes(demandee)) return demandee;
  return accessibles[0];
}

/**
 * Boutique visée par une opération (vente, dépense) : celle qu'elle porte si elle est accessible, sinon refus (undefined).
 * Sans boutique indiquée, on prend la boutique active. Une vente faite sans réseau dans la boutique A reste donc
 * dans la boutique A, même si l'utilisateur a changé de boutique avant l'envoi.
 */
export function boutiqueDeLOperation(
  demandee: string | null | undefined,
  accessibles: readonly string[],
  active: string | undefined,
): string | undefined {
  if (demandee) return accessibles.includes(demandee) ? demandee : undefined;
  return active;
}

/** Lecture sûre de la réponse de la base (`lister_boutiques`) : ignore toute ligne incomplète. */
export function lireBoutiquesAccessibles(brut: unknown): BoutiqueAccessible[] {
  if (!Array.isArray(brut)) return [];
  const resultat: BoutiqueAccessible[] = [];
  for (const b of brut) {
    if (!b || typeof b !== "object") continue;
    const l = b as Record<string, unknown>;
    if (typeof l.id !== "string" || typeof l.nom !== "string") continue;
    resultat.push({
      id: l.id,
      nom: l.nom,
      adresse: typeof l.adresse === "string" ? l.adresse : null,
      telephone: typeof l.telephone === "string" ? l.telephone : null,
      enEcriture: l.en_ecriture !== false,
    });
  }
  return resultat;
}
