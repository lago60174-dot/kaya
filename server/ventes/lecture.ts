import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecuDetail {
  id: string;
  numeroRecu: string;
  jetonPublic: string;
  date: string;
  annule: boolean;
  sousTotal: number;
  remise: number;
  total: number;
  boutique: {
    nom: string;
    adresse: string | null;
    telephone: string | null;
    mentionLegale: string | null;
  };
  client: { nom: string; telephone: string | null } | null;
  lignes: {
    nom: string;
    unite: string;
    quantite: number;
    prixUnitaire: number;
    remiseLigne: number;
    total: number;
  }[];
  paiements: { mode: string; montant: number }[];
  /** Reste dû par le client sur cette vente aujourd'hui. */
  credit: number;
}

/** Reçu complet pour l'écran et le partage. Aucune donnée de coût : la RLS ne les donne pas ici et on ne les demande pas. */
export async function lireRecu(
  supabase: SupabaseClient,
  venteId: string,
): Promise<RecuDetail | null> {
  const { data: v } = await supabase
    .from("ventes")
    .select(
      "id, numero_recu, jeton_public, date, statut, sous_total, remise, total, clients(nom, telephone), boutiques(nom, adresse, telephone, mention_legale)",
    )
    .eq("id", venteId)
    .maybeSingle();
  if (!v) return null;
  const [lignes, paiements, creance] = await Promise.all([
    supabase
      .from("vente_lignes")
      .select(
        "nom_produit, nom_unite, quantite, prix_unitaire, remise_ligne, total_ligne",
      )
      .eq("vente_id", venteId)
      .order("cree_le"),
    supabase
      .from("paiements")
      .select("mode, montant")
      .eq("vente_id", venteId)
      .eq("type", "vente")
      .order("date"),
    supabase
      .from("creances")
      .select("solde, statut")
      .eq("vente_id", venteId)
      .maybeSingle(),
  ]);
  const b = v.boutiques as unknown as {
    nom: string;
    adresse: string | null;
    telephone: string | null;
    mention_legale: string | null;
  };
  const c = v.clients as unknown as {
    nom: string;
    telephone: string | null;
  } | null;
  return {
    id: v.id,
    numeroRecu: v.numero_recu,
    jetonPublic: v.jeton_public,
    date: v.date,
    annule: v.statut === "annulee",
    sousTotal: Number(v.sous_total),
    remise: Number(v.remise),
    total: Number(v.total),
    boutique: {
      nom: b.nom,
      adresse: b.adresse,
      telephone: b.telephone,
      mentionLegale: b.mention_legale,
    },
    client: c,
    lignes: (lignes.data ?? []).map((l) => ({
      nom: l.nom_produit,
      unite: l.nom_unite,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prix_unitaire),
      remiseLigne: Number(l.remise_ligne),
      total: Number(l.total_ligne),
    })),
    paiements: (paiements.data ?? []).map((p) => ({
      mode: p.mode,
      montant: Number(p.montant),
    })),
    credit:
      creance.data && creance.data.statut === "ouverte"
        ? Number(creance.data.solde)
        : 0,
  };
}
