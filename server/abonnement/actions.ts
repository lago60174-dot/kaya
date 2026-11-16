"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServeur } from "@/lib/supabase/server";
import { accueilPour } from "@/lib/permissions";
import { exigerRole } from "@/server/auth/session";
import { lienPourFacture } from "./coeur";
import { servicesAbonnement } from "./services";

const uuid = z.uuid();

/** Bouton « Payer » de la page publique : crée (ou réutilise) le lien Fapshi puis y envoie le client. */
export async function payerAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get("factureId"));
  if (!id.success) redirect("/");
  let destination = `/payer/${id.data}?erreur=1`;
  try {
    const r = await lienPourFacture(servicesAbonnement(), id.data);
    if (r.type === "lien") destination = r.url;
    else if (r.type === "payee" || r.type === "annulee")
      destination = `/payer/${id.data}`;
  } catch {
    // message d'erreur affiché sur la page
  }
  redirect(destination);
}

export interface EtatAbonnementAction {
  erreur?: string;
}

/** Le propriétaire choisit son plan pour la prochaine facture. */
export async function choisirPlanAction(
  _etat: EtatAbonnementAction,
  formData: FormData,
): Promise<EtatAbonnementAction> {
  await exigerRole("proprietaire");
  const plan = z.string().min(1).max(20).safeParse(formData.get("plan"));
  if (!plan.success) return { erreur: "Choisissez un plan." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("choisir_plan", {
    p_plan: plan.data,
  });
  if (error) return { erreur: "Ce plan n'est pas disponible." };
  revalidatePath("/parametres");
  return {};
}

/** « Payer maintenant » : facture de l'échéance en cours (une seule par échéance) puis page de paiement. */
export async function payerMaintenantAction(): Promise<void> {
  const profil = await exigerRole("proprietaire");
  if (!profil.organisationId) redirect("/parametres");
  const { data } = await servicesAbonnement().db.rpc("facturer_echeance", {
    p_org: profil.organisationId,
  });
  redirect(typeof data === "string" ? `/payer/${data}` : "/parametres");
}

/**
 * Première formule de la boutique, choisie avant toute autre étape de la création. Le paiement peut venir plus tard :
 * la formule s'active au premier paiement. Accessible tant que la formule n'est pas choisie (zone « connecte »).
 */
export async function choisirPlanInitialAction(
  _etat: EtatAbonnementAction,
  formData: FormData,
): Promise<EtatAbonnementAction> {
  const profil = await exigerRole("connecte");
  if (profil.role !== "proprietaire") redirect(accueilPour(profil.role ?? "vendeur"));
  const plan = z
    .string()
    .regex(/^[a-z_]{2,30}$/)
    .safeParse(formData.get("plan"));
  if (!plan.success) return { erreur: "Choisissez une formule pour continuer." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("choisir_plan", { p_plan: plan.data });
  if (error)
    return { erreur: "Cette formule n'est pas disponible. Choisissez-en une autre." };
  redirect("/demarrage");
}
