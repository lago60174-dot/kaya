import { envServeur } from "@/lib/env";
import { secretsEgaux } from "@/lib/fapshi/webhook";
import { envoyerResumes } from "@/server/abonnement/resume";
import { servicesAbonnement } from "@/server/abonnement/services";

/**
 * Résumé WhatsApp quotidien : à appeler chaque soir (ex. 20:00, heure de Douala) depuis cron-job.org,
 * avec l'en-tête `Authorization: Bearer <CRON_SECRET>`. Sans CRON_SECRET la route reste inerte (503).
 */
export const maxDuration = 60;

async function executer(requete: Request) {
  const attendu = envServeur().CRON_SECRET;
  if (!attendu) return new Response("Non configuré", { status: 503 });
  const jeton = requete.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!(await secretsEgaux(jeton ?? null, attendu))) return new Response("Refusé", { status: 401 });
  try {
    return Response.json(await envoyerResumes(servicesAbonnement()));
  } catch {
    return Response.json({ erreur: "resumes" }, { status: 500 });
  }
}

export const GET = executer;
export const POST = executer;
