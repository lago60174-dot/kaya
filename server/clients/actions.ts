"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientSchema, paiementCreditSchema } from "@/lib/clients/schemas";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";

export interface EtatClient {
  erreur?: string;
  champs?: Record<string, string>;
  succes?: string;
}

const ERREUR_COMPTE = "Impossible de charger votre boutique. Reconnectez-vous.";

/** Crée un client (vendeur ou propriétaire) ou le modifie (propriétaire). Le plafond de crédit est réservé au propriétaire : la base le refuse au vendeur. */
export async function enregistrerClientAction(
  _e: EtatClient,
  formData: FormData,
): Promise<EtatClient> {
  const profil = await exigerRole("boutique");
  if (!profil.organisationId) return { erreur: ERREUR_COMPTE };
  const lu = clientSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) {
    const champs: Record<string, string> = {};
    for (const i of lu.error.issues) champs[String(i.path[0])] ??= i.message;
    return { erreur: "Vérifiez les champs en rouge.", champs };
  }
  const d = lu.data;
  const proprietaire = profil.role === "proprietaire";
  const supabase = await supabaseServeur();

  if (d.id) {
    if (!proprietaire)
      return { erreur: "Seul le propriétaire peut modifier un client." };
    const { data, error } = await supabase
      .from("clients")
      .update({
        nom: d.nom,
        telephone: d.telephone ?? null,
        notes: d.notes ?? null,
        plafond_credit: d.plafondCredit ?? null,
      })
      .eq("id", d.id)
      .select("id");
    if (error) return { erreur: messageErreurBase(error) };
    if (!data?.length) return { erreur: "Client introuvable." };
    revalidatePath("/clients");
    redirect(`/clients/${d.id}`);
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organisation_id: profil.organisationId,
      nom: d.nom,
      telephone: d.telephone ?? null,
      notes: d.notes ?? null,
      plafond_credit: proprietaire ? (d.plafondCredit ?? null) : null,
    })
    .select("id")
    .single();
  if (error || !data) return { erreur: messageErreurBase(error) };
  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function archiverClientAction(
  _e: EtatClient,
  formData: FormData,
): Promise<EtatClient> {
  await exigerRole("proprietaire");
  const id = String(formData.get("clientId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { erreur: "Client introuvable." };
  const { data, error } = await (
    await supabaseServeur()
  )
    .from("clients")
    .update({ archive_le: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { erreur: messageErreurBase(error) }; // « Ce client doit encore X FCFA » vient de la base
  if (!data?.length) return { erreur: "Client introuvable." };
  revalidatePath("/clients");
  redirect("/clients");
}

export type ResultatPaiement =
  | { ok: true; numero: string; dejaEnregistre: boolean }
  | { ok: false; erreur: string };

/** Enregistre le paiement d'un client : réparti sur ses plus anciennes dettes, un seul reçu, jamais deux fois grâce à la clé. */
export async function enregistrerPaiementAction(
  entree: unknown,
): Promise<ResultatPaiement> {
  const profil = await exigerRole("boutique");
  const boutiqueId = profil.boutiqueActiveId;
  if (!boutiqueId) return { ok: false, erreur: ERREUR_COMPTE };
  const lu = paiementCreditSchema.safeParse(entree);
  if (!lu.success)
    return {
      ok: false,
      erreur: lu.error.issues[0]?.message ?? "Paiement invalide.",
    };
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("rembourser_client", {
    p_boutique: boutiqueId,
    p_client: lu.data.clientId,
    p_montant: lu.data.montant,
    p_mode: lu.data.mode,
    p_cle: lu.data.cle,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  for (const chemin of [
    "/clients",
    "/clients/dettes",
    `/clients/${lu.data.clientId}`,
    "/recus",
    "/caisse",
  ])
    revalidatePath(chemin);
  return {
    ok: true,
    numero: data.numero_recu,
    dejaEnregistre: data.deja_enregistre === true,
  };
}
