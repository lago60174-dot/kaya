const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export interface FiltresRecus {
  recherche?: string;
  statut?: "valide" | "annulee";
  vendeur?: string;
  du?: string;
  au?: string;
  apresDate?: string;
  apresId?: string;
}

const jourValide = (v: string | undefined) =>
  v && JOUR.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
    ? v
    : undefined;

/** Lit les paramètres de l'adresse sans jamais les faire confiance : tout ce qui est invalide est ignoré. */
export function filtresDepuisParametres(
  p: Record<string, string | undefined>,
): FiltresRecus {
  const apresDate =
    p.apres_date && !Number.isNaN(Date.parse(p.apres_date))
      ? p.apres_date
      : undefined;
  const apresId = p.apres_id && UUID.test(p.apres_id) ? p.apres_id : undefined;
  return {
    recherche: p.q?.trim().slice(0, 60) || undefined,
    statut:
      p.statut === "valide" || p.statut === "annulee" ? p.statut : undefined,
    vendeur: p.vendeur && UUID.test(p.vendeur) ? p.vendeur : undefined,
    du: jourValide(p.du),
    au: jourValide(p.au),
    // Le curseur ne sert que s'il est complet.
    ...(apresDate && apresId ? { apresDate, apresId } : {}),
  };
}

export const libelleStatut = (statut: string) =>
  statut === "annulee" ? "Annulé" : "Valide";
