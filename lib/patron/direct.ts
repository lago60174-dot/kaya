/**
 * Mode de mise à jour du tableau de bord.
 * - onglet caché : rien (on coupe l'abonnement temps réel et l'actualisation, pour économiser Supabase et la batterie) ;
 * - temps réel connecté : mises à jour en direct, sans minuteur ;
 * - temps réel coupé ou en échec : actualisation toutes les 30 secondes.
 */
export type ModeMiseAJour = "arret" | "direct" | "secours";

export const DELAI_SECOURS_MS = 30_000;
export const DELAI_REGROUPEMENT_MS = 800;

export function modeMiseAJour(etat: {
  visible: boolean;
  canalConnecte: boolean;
}): ModeMiseAJour {
  if (!etat.visible) return "arret";
  return etat.canalConnecte ? "direct" : "secours";
}

/** Variation en pourcentage entier par rapport à hier, ou null s'il n'y a pas de base de comparaison. */
export function variationVsHier(
  aujourdhui: number,
  hier: number,
): number | null {
  if (hier <= 0) return null;
  return Math.round(((aujourdhui - hier) / hier) * 100);
}
