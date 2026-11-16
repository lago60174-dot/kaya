import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import {
  canauxEffectifs,
  nettoyerPreferences,
} from "@/lib/notifications/catalogue";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Clés VAPID : générées une fois avec `npx web-push generate-vapid-keys`. Sans elles, le push est simplement désactivé. */
export function configPush() {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  const sujet = process.env.VAPID_SUBJECT;
  return publique && privee && sujet ? { publique, privee, sujet } : null;
}

/**
 * Envoie les notifications push en attente d'une organisation, selon les choix du propriétaire.
 * Chaque notification est « réservée » avant l'envoi (mise à jour conditionnelle) : jamais d'envoi en double,
 * même si deux actions se terminent en même temps. Un abonnement expiré est supprimé.
 */
export async function diffuserNotifications(
  organisationId: string,
): Promise<void> {
  const config = configPush();
  if (!config) return;
  const admin = supabaseAdmin();
  const { data: abonnements } = await admin
    .from("abonnements_push")
    .select("id, endpoint, p256dh, auth")
    .eq("organisation_id", organisationId);
  if (!abonnements?.length) return;

  const depuis = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: reservees } = await admin
    .from("notifications")
    .update({ push_envoye_le: new Date().toISOString() })
    .eq("organisation_id", organisationId)
    .is("push_envoye_le", null)
    .gte("cree_le", depuis)
    .select("id, type, titre, corps, lien");
  if (!reservees?.length) return;

  const { data: prefs } = await admin
    .from("preferences_notifications")
    .select("canaux")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  const surcharges = nettoyerPreferences(prefs?.canaux ?? {});

  setVapidDetails(config.sujet, config.publique, config.privee);
  const expires = new Set<string>();
  for (const n of reservees) {
    if (!canauxEffectifs(n.type, surcharges).push) continue;
    const contenu = JSON.stringify({
      titre: n.titre,
      corps: n.corps ?? "",
      lien: n.lien ?? "/notifications",
      tag: `kaya-${n.type}`,
    });
    await Promise.all(
      abonnements.map(async (a) => {
        try {
          await sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            contenu,
            { TTL: 3600, urgency: "high" },
          );
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) expires.add(a.id);
        }
      }),
    );
  }
  if (expires.size)
    await admin.from("abonnements_push").delete().in("id", [...expires]);
}
