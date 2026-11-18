"use server";

import { planifierNotifications } from "@/server/notifications/declencher";
import { revalidatePath } from "next/cache";
import {
  annulationDepenseSchema,
  clotureSchema,
  depenseSchema,
  validationClotureSchema,
} from "@/lib/caisse/schemas";
import { boutiqueDeLOperation } from "@/lib/boutiques/active";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";

const ERREUR_COMPTE = "Impossible de charger votre boutique. Reconnectez-vous.";

export type ResultatCaisse =
  { ok: true; ecart?: number } | { ok: false; erreur: string };

/** Enregistre une dépense. La clé évite un doublon en cas de double clic ou de nouvel essai. */
export async function enregistrerDepenseAction(
  entree: unknown,
): Promise<ResultatCaisse> {
  const profil = await exigerRole("boutique");
  const lu = depenseSchema.safeParse(entree);
  if (!lu.success)
    return {
      ok: false,
      erreur: lu.error.issues[0]?.message ?? "Dépense invalide.",
    };
  const boutiqueId = boutiqueDeLOperation(lu.data.boutiqueId, profil.boutiqueIds, profil.boutiqueActiveId);
  if (!boutiqueId) return { ok: false, erreur: ERREUR_COMPTE };
  const { error } = await (
    await supabaseServeur()
  ).rpc("enregistrer_depense", {
    p_boutique: boutiqueId,
    p_categorie: lu.data.categorie,
    p_montant: lu.data.montant,
    p_mode: lu.data.mode,
    p_note: lu.data.note ?? null,
    p_cle: lu.data.cle,
  });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/caisse");
  return { ok: true };
}

/** Annule une dépense saisie par erreur : propriétaire seulement, motif obligatoire (la base le vérifie aussi). */
export async function annulerDepenseAction(
  entree: unknown,
): Promise<ResultatCaisse> {
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueActiveId;
  if (!boutiqueId) return { ok: false, erreur: ERREUR_COMPTE };
  const lu = annulationDepenseSchema.safeParse(entree);
  if (!lu.success)
    return {
      ok: false,
      erreur: lu.error.issues[0]?.message ?? "Annulation invalide.",
    };
  const { error } = await (
    await supabaseServeur()
  ).rpc("annuler_depense", {
    p_boutique: boutiqueId,
    p_depense: lu.data.depenseId,
    p_motif: lu.data.motif,
  });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/caisse");
  return { ok: true };
}

/** Clôture la caisse d'un jour : la base recalcule les espèces attendues, l'écart et l'alerte. */
export async function cloturerCaisseAction(
  entree: unknown,
): Promise<ResultatCaisse> {
  const profil = await exigerRole("boutique");
  const boutiqueId = profil.boutiqueActiveId;
  if (!boutiqueId) return { ok: false, erreur: ERREUR_COMPTE };
  const lu = clotureSchema.safeParse(entree);
  if (!lu.success)
    return {
      ok: false,
      erreur: lu.error.issues[0]?.message ?? "Saisie invalide.",
    };
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("cloturer_caisse", {
    p_boutique: boutiqueId,
    p_date: lu.data.date,
    p_especes_comptees: lu.data.especesComptees,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/caisse");
  planifierNotifications(profil.organisationId);
  return { ok: true, ecart: Number((data as { ecart: number }).ecart) };
}

/** Validation d'une clôture : propriétaire seulement (la base le vérifie aussi). */
export async function validerClotureAction(
  entree: unknown,
): Promise<ResultatCaisse> {
  await exigerRole("proprietaire");
  const lu = validationClotureSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: "Clôture introuvable." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("valider_cloture", { p_cloture: lu.data.clotureId });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/caisse");
  return { ok: true };
}
