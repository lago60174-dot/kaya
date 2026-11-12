import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { supabasePublic } from "@/lib/supabase/public";
import type { FiltresRecus } from "@/lib/ventes/historique";
import {
  recuPublicDepuisJson,
  type RecuAffichable,
  type RecuDetail,
} from "@/lib/ventes/recu";

/** Reçu complet pour l'écran, le PDF et le partage. Aucune donnée de coût : on ne la demande pas (et la RLS la cache au vendeur). */
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
  const [lignes, paiements, creance, avoir] = await Promise.all([
    supabase
      .from("vente_lignes")
      .select(
        "nom_produit, nom_unite, quantite, prix_unitaire, remise_ligne, total_ligne",
      )
      .eq("vente_id", venteId)
      .order("ordre")
      .order("id"),
    supabase
      .from("paiements")
      .select("mode, montant")
      .eq("vente_id", venteId)
      .eq("type", "vente")
      .order("date")
      .order("id"),
    supabase
      .from("creances")
      .select("solde, statut")
      .eq("vente_id", venteId)
      .maybeSingle(),
    supabase
      .from("avoirs")
      .select("numero, motif, date")
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
    jetonPublic: v.jeton_public,
    numeroRecu: v.numero_recu,
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
    avoir: avoir.data
      ? {
          numero: avoir.data.numero,
          motif: avoir.data.motif,
          date: avoir.data.date,
        }
      : null,
  };
}

export interface LigneRecu {
  id: string;
  numero_recu: string;
  date: string;
  statut: "valide" | "annulee";
  total: number;
  vendeur_id: string;
  client_nom: string | null;
  vendeur_nom: string | null;
  credit: number;
}

export interface PageRecus {
  recus: LigneRecu[];
  suivant: { date: string; id: string } | null;
}

export async function listerRecus(
  supabase: SupabaseClient,
  boutiqueId: string,
  f: FiltresRecus,
): Promise<PageRecus> {
  const { data, error } = await supabase.rpc("lister_recus", {
    p_boutique: boutiqueId,
    p_recherche: f.recherche ?? null,
    p_statut: f.statut ?? null,
    p_vendeur: f.vendeur ?? null,
    p_du: f.du ?? null,
    p_au: f.au ?? null,
    p_limite: 30,
    p_apres_date: f.apresDate ?? null,
    p_apres_id: f.apresId ?? null,
  });
  if (error || !data) return { recus: [], suivant: null };
  const page = data as PageRecus;
  return {
    suivant: page.suivant,
    recus: page.recus.map((r) => ({
      ...r,
      total: Number(r.total),
      credit: Number(r.credit),
    })),
  };
}

/**
 * Reçu public par jeton, mis en cache une minute : un lien partagé sur WhatsApp peut être ouvert des dizaines de fois.
 * Court exprès : une annulation ou un remboursement de crédit doit apparaître vite.
 */
export async function lireRecuPublic(
  jeton: string,
): Promise<RecuAffichable | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  if (!/^[0-9a-f]{64}$/.test(jeton)) return null;
  const { data } = await supabasePublic().rpc("recu_public", {
    p_jeton: jeton,
  });
  return data ? recuPublicDepuisJson(data) : null;
}
