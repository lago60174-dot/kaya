import { envServeur } from "@/lib/env";
import { secretsEgaux } from "@/lib/fapshi/webhook";
import { executerCron } from "@/server/abonnement/coeur";
import { servicesAbonnement } from "@/server/abonnement/services";

/**
 * Tâche quotidienne : cycle de vie des abonnements, factures d'échéance et relances WhatsApp.
 * Appelée par cron-job.org (GET ou POST) avec l'en-tête `Authorization: Bearer <CRON_SECRET>` ; POST accepté pour un déclenchement manuel.
 * Sans CRON_SECRET, la route reste inerte (503) : aucun compte n'est suspendu par accident.
 */
export const maxDuration = 60;

async function executer(requete: Request) {
  const attendu = envServeur().CRON_SECRET;
  if (!attendu) return new Response("Non configuré", { status: 503 });
  const jeton = requete.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!(await secretsEgaux(jeton ?? null, attendu)))
    return new Response("Refusé", { status: 401 });
  return Response.json(await executerCron(servicesAbonnement()));
}

export const GET = executer;
export const POST = executer;
