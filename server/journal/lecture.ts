import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alerte } from "@/server/patron/lecture";

export interface EntreeJournal extends Alerte {
  alerte: boolean;
  auteur: string | null;
}

export interface PageJournal {
  entrees: EntreeJournal[];
  suivant: { date: string; id: number } | null;
}

interface LigneBrute {
  id: number | string;
  cree_le: string;
  action: string;
  details: Record<string, unknown> | null;
  entite: string | null;
  entite_id: string | null;
  alerte: boolean;
  auteur_id: string | null;
}

interface Parametres {
  boutiqueId: string | null;
  actions: string[];
  alertesSeulement: boolean;
  du: string | null;
  au: string | null;
  apres: { date: string; id: number } | null;
}

/** Une page du journal, du plus récent au plus ancien. Les filtres sont typés côté base (aucun filtre construit en texte). */
export async function lireJournal(
  supabase: SupabaseClient,
  p: Parametres,
  limite = 30,
): Promise<PageJournal | null> {
  const [{ data, error }, membres] = await Promise.all([
    supabase.rpc("lister_journal", {
      p_boutique: p.boutiqueId,
      p_actions: p.actions,
      p_alertes: p.alertesSeulement,
      p_du: p.du,
      p_au: p.au,
      p_limite: limite,
      p_apres: p.apres?.date ?? null,
      p_apres_id: p.apres?.id ?? null,
    }),
    supabase.from("membres").select("utilisateur_id, nom"),
  ]);
  if (error || !data) return null;
  const noms = new Map(
    (membres.data ?? []).map((m) => [
      m.utilisateur_id as string,
      m.nom as string,
    ]),
  );
  const lignes = data.entrees as LigneBrute[];
  return {
    entrees: lignes.map((e) => ({
      id: Number(e.id),
      creeLe: e.cree_le,
      action: e.action,
      details: e.details ?? {},
      entite: e.entite,
      entiteId: e.entite_id,
      alerte: Boolean(e.alerte),
      auteur: e.auteur_id ? (noms.get(e.auteur_id) ?? null) : null,
    })),
    suivant: data.suivant ?? null,
  };
}
