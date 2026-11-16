import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canauxEffectifs,
  nettoyerPreferences,
  type Surcharges,
} from "@/lib/notifications/catalogue";

export interface NotificationLue {
  id: number;
  type: string;
  titre: string;
  corps: string | null;
  lien: string | null;
  critique: boolean;
  creeLe: string;
  lue: boolean;
}

export async function lirePreferences(
  supabase: SupabaseClient,
): Promise<Surcharges> {
  const { data } = await supabase
    .from("preferences_notifications")
    .select("canaux")
    .maybeSingle();
  return nettoyerPreferences(data?.canaux ?? {});
}

/** Dernières notifications du propriétaire. Un type que le propriétaire a retiré de l'application n'apparaît pas. */
export async function listerNotifications(
  supabase: SupabaseClient,
  surcharges: Surcharges,
  limite = 50,
): Promise<NotificationLue[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, type, titre, corps, lien, critique, cree_le, lue_le")
    .order("cree_le", { ascending: false })
    .limit(limite);
  return (data ?? [])
    .filter((n) => canauxEffectifs(n.type, surcharges).app)
    .map((n) => ({
      id: Number(n.id),
      type: n.type,
      titre: n.titre,
      corps: n.corps,
      lien: n.lien,
      critique: n.critique,
      creeLe: n.cree_le,
      lue: n.lue_le !== null,
    }));
}

export async function compterNonLues(
  supabase: SupabaseClient,
): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("lue_le", null);
  return count ?? 0;
}
