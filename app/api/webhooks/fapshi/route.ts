import { envServeur } from "@/lib/env";
import { lireNotification, secretsEgaux } from "@/lib/fapshi/webhook";
import { traiterNotification } from "@/server/abonnement/coeur";
import { servicesAbonnement } from "@/server/abonnement/services";

/**
 * Notification Fapshi. Le secret statique `x-wh-secret` est vérifié, puis l'état réel est relu chez Fapshi avant tout effet.
 * Pas de nouvel essai côté Fapshi : si le traitement échoue, la tâche planifiée rattrape le paiement.
 * Rien du corps ni des en-têtes n'est journalisé.
 */
export async function POST(requete: Request) {
  const attendu = envServeur().FAPSHI_WEBHOOK_SECRET;
  if (!attendu) return new Response("Non configuré", { status: 503 });
  if (!(await secretsEgaux(requete.headers.get("x-wh-secret"), attendu)))
    return new Response("Refusé", { status: 401 });
  const notification = lireNotification(await requete.json().catch(() => null));
  if (!notification) return new Response("Requête invalide", { status: 400 });
  try {
    await traiterNotification(servicesAbonnement(), notification);
  } catch {
    return new Response("Traitement différé", { status: 500 });
  }
  return Response.json({ ok: true });
}
