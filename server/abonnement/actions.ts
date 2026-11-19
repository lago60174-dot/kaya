"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServeur } from "@/lib/supabase/server";
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

/** Étape obligatoire de la création de la boutique : le choix lève la porte, le paiement peut venir plus tard. */
export async function choisirPlanInitialAction(
  _etat: EtatAbonnementAction,
  formData: FormData,
): Promise<EtatAbonnementAction> {
  const profil = await exigerRole("connecte");
  if (profil.role !== "proprietaire") redirect("/");
  const plan = z.string().min(1).max(20).safeParse(formData.get("plan"));
  if (!plan.success) return { erreur: "Choisissez une formule pour continuer." };
  const { error } = await (await supabaseServeur()).rpc("choisir_plan", { p_plan: plan.data });
  if (error) return { erreur: "Cette formule n'est pas disponible." };
  revalidatePath("/", "layout");
  redirect("/patron");
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

export interface EtatResume {
  erreur?: string;
  ok?: string;
}

/** Le propriétaire active ou coupe le résumé WhatsApp quotidien (la base vérifie le plan et le numéro). */
export async function reglerResumeAction(_etat: EtatResume, formData: FormData): Promise<EtatResume> {
  await exigerRole("proprietaire");
  const actif = formData.get("actif") === "1";
  const { error } = await (await supabaseServeur()).rpc("regler_resume_whatsapp", { p_actif: actif });
  if (error) return { erreur: error.code === "P0001" ? error.message : "Impossible de modifier ce réglage. Réessayez." };
  revalidatePath("/parametres");
  return { ok: actif ? "Résumé quotidien activé." : "Résumé quotidien désactivé." };
}
