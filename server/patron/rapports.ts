import type { SupabaseClient } from "@supabase/supabase-js";

export interface Rapport {
  jours: number;
  total: number;
  nbVentes: number;
  serie: { jour: string; total: number; nb: number }[];
  produits: { produitId: string; nom: string; quantiteBase: number; uniteBase: string; montant: number }[];
  /** Bénéfice estimé et encaissements par mode ; null / vide si la fonction SQL n'est pas encore installée. */
  benefice: number | null;
  modes: { mode: string; montant: number }[];
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
  const { data: comp } = await supabase.rpc("rapport_complement", { p_boutique: boutiqueId, p_jours: jours });
  const c = (comp ?? null) as Brut | null;
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
    benefice: c ? Number(c.benefice) : null,
    modes: c ? (c.modes as Brut[]).map((m) => ({ mode: m.mode, montant: Number(m.montant) })) : [],
    vendeurs: (b.vendeurs as Brut[]).map((v) => ({
      vendeurId: v.vendeur_id,
      nom: v.nom,
      nbVentes: Number(v.nb_ventes),
      total: Number(v.total),
    })),
  };
}

export interface ClassementSemaine {
  debut: string;
  fin: string;
  vendeurs: { vendeurId: string; nom: string; nbVentes: number; total: number }[];
  produits: { produitId: string; nom: string; quantiteBase: number; uniteBase: string; montant: number }[];
}

/** Classement d'une semaine (lundi → dimanche) : 0 = cette semaine, 1 = la précédente… Null si la fonction SQL est absente. */
export async function lireClassementSemaine(
  supabase: SupabaseClient,
  boutiqueId: string,
  decalage: number,
): Promise<ClassementSemaine | null> {
  const { data, error } = await supabase.rpc("classement_semaine", { p_boutique: boutiqueId, p_decalage: decalage });
  if (error || !data) return null;
  const b = data as Brut;
  return {
    debut: String(b.debut),
    fin: String(b.fin),
    vendeurs: (b.vendeurs as Brut[]).map((v) => ({
      vendeurId: v.vendeur_id,
      nom: v.nom,
      nbVentes: Number(v.nb_ventes),
      total: Number(v.total),
    })),
    produits: (b.produits as Brut[]).map((p) => ({
      produitId: p.produit_id,
      nom: p.nom,
      quantiteBase: Number(p.quantite_base),
      uniteBase: p.unite_base,
      montant: Number(p.montant),
    })),
  };
}
