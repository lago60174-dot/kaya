"use server";

import { revalidatePath } from "next/cache";
import {
  bonLivraisonSchema,
  conversionSchema,
  devisSchema,
} from "@/lib/devis/schemas";
import { supabaseServeur } from "@/lib/supabase/server";
import { messageErreurBase } from "@/server/erreurs";
import { planifierNotifications } from "@/server/notifications/declencher";
import { exigerDevis } from "./acces";

const UUID = /^[0-9a-f-]{36}$/i;

export type ResultatDevis =
  | { ok: true; devisId: string; numero: string | null; statut: string }
  | { ok: false; erreur: string };

/** Enregistre un brouillon, ou l'envoie (numéro attribué, plus modifiable). Les prix viennent de la base. */
export async function enregistrerDevisAction(
  entree: unknown,
): Promise<ResultatDevis> {
  const { boutiqueId } = await exigerDevis();
  if (!boutiqueId)
    return { ok: false, erreur: "Aucune boutique n'est associée à votre compte." };
  const lu = devisSchema.safeParse(entree);
  if (!lu.success)
    return { ok: false, erreur: lu.error.issues[0]?.message ?? "Devis invalide." };
  const d = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("enregistrer_devis", {
    p_boutique: boutiqueId,
    p_cle: d.cle,
    p_id: d.id ?? null,
    p_type: d.type,
    p_client: d.clientId ?? null,
    p_lignes: d.lignes.map((l) => ({
      produit_id: l.produitId,
      unite_id: l.uniteId,
      quantite: l.quantite,
    })),
    p_remise: d.remise,
    p_valide_jusqu: d.valideJusqu,
    p_conditions: d.conditions || null,
    p_note: d.note || null,
    p_envoyer: d.envoyer,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/devis");
  return {
    ok: true,
    devisId: data.devis_id,
    numero: data.numero ?? null,
    statut: data.statut,
  };
}

export interface EtatSimple {
  ok: boolean;
  erreur?: string;
}

/** Le client a accepté ou refusé. */
export async function marquerDevisAction(
  devisId: string,
  statut: "accepte" | "refuse",
): Promise<EtatSimple> {
  await exigerDevis();
  if (!UUID.test(devisId) || (statut !== "accepte" && statut !== "refuse"))
    return { ok: false, erreur: "Devis introuvable." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("marquer_devis", { p_devis: devisId, p_statut: statut });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  return { ok: true };
}

/** Supprime un brouillon (archivé, jamais effacé). */
export async function supprimerBrouillonAction(
  devisId: string,
): Promise<EtatSimple> {
  await exigerDevis();
  if (!UUID.test(devisId)) return { ok: false, erreur: "Devis introuvable." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("archiver_devis_brouillon", { p_devis: devisId });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/devis");
  return { ok: true };
}

/** Nouveau brouillon à partir d'un devis (correction, ou nouvelle offre). */
export async function dupliquerDevisAction(
  devisId: string,
  cle: string,
): Promise<ResultatDevis> {
  await exigerDevis();
  if (!UUID.test(devisId) || !UUID.test(cle))
    return { ok: false, erreur: "Devis introuvable." };
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("dupliquer_devis", { p_devis: devisId, p_cle: cle });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/devis");
  return { ok: true, devisId: data.devis_id, numero: null, statut: "brouillon" };
}

export type ResultatConversion =
  | {
      ok: true;
      venteId: string;
      numeroRecu: string;
      total: number;
      totalDevis: number;
    }
  | { ok: false; erreur: string };

/** Transforme un devis accepté en vente : stock, crédit, reçu et caisse suivent les règles d'une vente normale. */
export async function convertirDevisAction(
  entree: unknown,
): Promise<ResultatConversion> {
  const { profil } = await exigerDevis();
  const lu = conversionSchema.safeParse(entree);
  if (!lu.success)
    return { ok: false, erreur: lu.error.issues[0]?.message ?? "Conversion invalide." };
  const d = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("convertir_devis", {
    p_devis: d.devisId,
    p_cle: d.cle,
    p_paiements: d.paiements,
    p_forcer: d.forcer,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/devis");
  revalidatePath(`/devis/${d.devisId}`);
  revalidatePath("/stock");
  revalidatePath("/recus");
  planifierNotifications(profil.organisationId);
  return {
    ok: true,
    venteId: data.vente_id,
    numeroRecu: data.numero_recu,
    total: Number(data.total),
    totalDevis: Number(data.total_devis),
  };
}

export type ResultatBon =
  | { ok: true; bonId: string; numero: string }
  | { ok: false; erreur: string };

/** Bon de livraison d'une vente ou d'un devis accepté. Un second appel renvoie le premier bon. */
export async function creerBonLivraisonAction(
  entree: unknown,
): Promise<ResultatBon> {
  const { boutiqueId } = await exigerDevis();
  if (!boutiqueId)
    return { ok: false, erreur: "Aucune boutique n'est associée à votre compte." };
  const lu = bonLivraisonSchema.safeParse(entree);
  if (!lu.success)
    return { ok: false, erreur: lu.error.issues[0]?.message ?? "Bon invalide." };
  const d = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("creer_bon_livraison", {
    p_boutique: boutiqueId,
    p_vente: d.venteId ?? null,
    p_devis: d.devisId ?? null,
    p_adresse: d.adresse || null,
    p_note: d.note || null,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/devis/livraisons");
  if (d.devisId) revalidatePath(`/devis/${d.devisId}`);
  return { ok: true, bonId: data.bon_id, numero: data.numero };
}
