import type { SupabaseClient } from "@supabase/supabase-js";

export interface Rapport {
  jours: number;
  total: number;
  nbVentes: number;
  serie: { jour: string; total: number; nb: number }[];
  produits: { produitId: string; nom: string; quantiteBase: number; uniteBase: string; montant: number }[];
  vendeurs: { vendeurId: string; nom: string; nbVentes: number; total: number }[];
}

type Brut = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Ventes jour par jour et classements sur 7, 30 ou 90 jours (réservé au propriétaire, vérifié par la base). */
export async function lireRapport(
  supabase: SupabaseClient,
  boutiqueId: string,
  jours: number,
): Promise<Rapport | null> {
  const { data, error } = await supabase.rpc("rapport_ventes", {
    p_boutique: boutiqueId,
    p_jours: jours,
  });
  if (error || !data) return null;
  const b = data as Brut;
  return {
    jours: Number(b.jours),
    total: Number(b.total),
    nbVentes: Number(b.nb_ventes),
    serie: (b.serie as Brut[]).map((s) => ({ jour: String(s.jour), total: Number(s.total), nb: Number(s.nb) })),
    produits: (b.produits as Brut[]).map((p) => ({
      produitId: p.produit_id,
      nom: p.nom,
      quantiteBase: Number(p.quantite_base),
      uniteBase: p.unite_base,
      montant: Number(p.montant),
    })),
    vendeurs: (b.vendeurs as Brut[]).map((v) => ({
      vendeurId: v.vendeur_id,
      nom: v.nom,
      nbVentes: Number(v.nb_ventes),
      total: Number(v.total),
    })),
  };
}
