/**
 * Mode de mise à jour du tableau de bord.
 * - onglet caché : rien (on coupe l'abonnement temps réel et l'actualisation, pour économiser Supabase et la batterie) ;
 * - temps réel connecté : mises à jour instantanées sur les ventes, paiements, dépenses et clôtures ;
 * - temps réel coupé ou en échec : on s'appuie sur l'actualisation périodique.
 *
 * Dans tous les cas où l'onglet est visible, le tableau de bord est actualisé toutes les minutes.
 * Ce rythme couvre aussi ce que le temps réel n'écoute pas (dettes clients, stock bas, alertes).
 */
export type ModeMiseAJour = "arret" | "direct" | "minute";

/** Actualisation périodique : une minute. */
export const DELAI_ACTUALISATION_MS = 60_000;
export const DELAI_REGROUPEMENT_MS = 800;
/** Si une actualisation vient d'avoir lieu (temps réel, retour sur l'onglet), le tic de la minute attend. */
export const DELAI_MINIMUM_MS = 10_000;

export function modeMiseAJour(etat: {
  visible: boolean;
  canalConnecte: boolean;
}): ModeMiseAJour {
  if (!etat.visible) return "arret";
  return etat.canalConnecte ? "direct" : "minute";
}

/**
 * Décide si le tic périodique doit actualiser maintenant.
 * Jamais onglet caché, jamais hors connexion (le navigateur le sait), et pas deux fois de suite à quelques secondes d'écart.
 */
export function doitActualiser(etat: {
  visible: boolean;
  enLigne: boolean;
  dernierMs: number;
  maintenantMs: number;
}): boolean {
  if (!etat.visible || !etat.enLigne) return false;
  return etat.maintenantMs - etat.dernierMs >= DELAI_MINIMUM_MS;
}

/** Variation en pourcentage entier par rapport à hier, ou null s'il n'y a pas de base de comparaison. */
export function variationVsHier(
  aujourdhui: number,
  hier: number,
): number | null {
  if (hier <= 0) return null;
  return Math.round(((aujourdhui - hier) / hier) * 100);
}
