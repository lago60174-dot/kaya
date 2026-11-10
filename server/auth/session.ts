import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decisionGarde, type Zone } from "@/lib/permissions";
import { supabaseServeur } from "@/lib/supabase/server";
import { chargerProfil, type Profil } from "./profil";

/** Profil de l'utilisateur connecté (vérifié auprès de Supabase), une seule lecture par requête. */
export const lireSession = cache(async (): Promise<Profil | null> => {
  const supabase = await supabaseServeur();
  const { data } = await supabase.auth.getUser();
  return data.user ? chargerProfil(supabase, data.user) : null;
});

/** À appeler en tête de chaque page protégée et de chaque action serveur. */
export async function exigerRole(zone: Zone): Promise<Profil> {
  const profil = await lireSession();
  const decision = decisionGarde(profil, zone);
  if (decision.type === "rediriger") redirect(decision.vers);
  return profil as Profil;
}
