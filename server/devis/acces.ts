import "server-only";
import { redirect } from "next/navigation";
import { decisionGarde } from "@/lib/permissions";
import { peutUtiliser } from "@/lib/plans";
import { exigerRole, lireSession } from "@/server/auth/session";

/**
 * Pages et actions des devis : propriétaire d'un plan qui inclut les devis. Une fonction d'un plan supérieur
 * ne s'atteint pas en tapant l'adresse (la base refuse aussi, voir exiger_acces_devis).
 */
export async function exigerDevis() {
  const profil = await exigerRole("proprietaire");
  if (!profil.plan || !peutUtiliser(profil.plan, "devis")) redirect("/patron");
  const boutiqueId = profil.boutiqueIds[0];
  return { profil, boutiqueId: boutiqueId ?? null };
}

/** Pour les routes (PDF) : elles ne passent pas par la garde des pages. */
export async function refuserSiPasDevis(): Promise<Response | null> {
  const session = await lireSession();
  if (decisionGarde(session, "proprietaire").type !== "ok")
    return new Response("Non autorisé", { status: 401 });
  if (!session?.plan || !peutUtiliser(session.plan, "devis"))
    return new Response("Les devis ne sont pas inclus dans votre abonnement.", {
      status: 403,
    });
  return null;
}
