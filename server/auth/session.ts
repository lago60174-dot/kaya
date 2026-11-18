import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_BOUTIQUE } from "@/lib/boutiques/active";
import { decisionGarde, type Zone } from "@/lib/permissions";
import { supabaseServeur } from "@/lib/supabase/server";
import { chargerProfil, type Profil } from "./profil";

/** Profil de l'utilisateur connecté (vérifié auprès de Supabase), une seule lecture par requête. */
export const lireSession = cache(async (): Promise<Profil | null> => {
  const supabase = await supabaseServeur();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const demandee = (await cookies()).get(COOKIE_BOUTIQUE)?.value;
  return chargerProfil(supabase, data.user, demandee);
});

/** À appeler en tête de chaque page protégée et de chaque action serveur. */
export async function exigerRole(zone: Zone): Promise<Profil> {
  const profil = await lireSession();
  const decision = decisionGarde(profil, zone);
  if (decision.type === "rediriger") redirect(decision.vers);
  return profil as Profil;
}
