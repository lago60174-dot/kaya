"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nettoyerPreferences } from "@/lib/notifications/catalogue";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";

export interface EtatNotifications {
  erreur?: string;
  succes?: string;
}

export async function marquerToutesLuesAction(): Promise<void> {
  await exigerRole("proprietaire");
  await (await supabaseServeur()).rpc("marquer_notifications_lues", {
    p_ids: null,
  });
  revalidatePath("/notifications");
}

export async function marquerLueAction(id: number): Promise<void> {
  await exigerRole("proprietaire");
  if (!Number.isInteger(id) || id <= 0) return;
  await (await supabaseServeur()).rpc("marquer_notifications_lues", {
    p_ids: [id],
  });
  revalidatePath("/notifications");
}

/** Enregistre où le propriétaire veut recevoir chaque alerte. La base vérifie le rôle. */
export async function enregistrerPreferencesAction(
  entree: unknown,
): Promise<EtatNotifications> {
  await exigerRole("proprietaire");
  const canaux = nettoyerPreferences(entree);
  const { error } = await (
    await supabaseServeur()
  ).rpc("enregistrer_preferences_notifications", { p_canaux: canaux });
  if (error)
    return { erreur: "Vos choix n'ont pas pu être enregistrés. Réessayez." };
  revalidatePath("/notifications");
  return { succes: "Vos choix sont enregistrés." };
}

const abonnementSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(10).max(100),
  }),
});

/** Associe cet appareil au propriétaire pour les notifications push. */
export async function enregistrerPushAction(
  entree: unknown,
): Promise<EtatNotifications> {
  const profil = await exigerRole("proprietaire");
  const lu = abonnementSchema.safeParse(entree);
  if (!lu.success || !profil.organisationId)
    return { erreur: "Cet appareil n'a pas pu être enregistré." };
  const { error } = await supabaseAdmin()
    .from("abonnements_push")
    .upsert(
      {
        utilisateur_id: profil.userId,
        organisation_id: profil.organisationId,
        endpoint: lu.data.endpoint,
        p256dh: lu.data.keys.p256dh,
        auth: lu.data.keys.auth,
      },
      { onConflict: "endpoint" },
    );
  if (error) return { erreur: "Cet appareil n'a pas pu être enregistré." };
  return { succes: "Notifications activées sur cet appareil." };
}

export async function retirerPushAction(
  endpoint: string,
): Promise<EtatNotifications> {
  const profil = await exigerRole("proprietaire");
  await supabaseAdmin()
    .from("abonnements_push")
    .delete()
    .eq("endpoint", endpoint)
    .eq("utilisateur_id", profil.userId);
  return { succes: "Notifications désactivées sur cet appareil." };
}
