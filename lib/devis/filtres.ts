import { STATUTS_DEVIS, type StatutDevis, type TypeDevis } from "./devis";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface FiltresDevisAdresse {
  recherche?: string;
  statut?: StatutDevis;
  type?: TypeDevis;
  apresDate?: string;
  apresId?: string;
}

/** Lit les paramètres de l'adresse sans jamais leur faire confiance : tout ce qui est invalide est ignoré. */
export function filtresDevisDepuisParametres(
  p: Record<string, string | undefined>,
): FiltresDevisAdresse {
  const apresDate =
    p.apres_date && !Number.isNaN(Date.parse(p.apres_date)) ? p.apres_date : undefined;
  const apresId = p.apres_id && UUID.test(p.apres_id) ? p.apres_id : undefined;
  return {
    recherche: p.q?.trim().slice(0, 60) || undefined,
    statut: STATUTS_DEVIS.find((s) => s.code === p.statut)?.code,
    type: p.type === "devis" || p.type === "proforma" ? p.type : undefined,
    ...(apresDate && apresId ? { apresDate, apresId } : {}),
  };
}
