"use server";

import { revalidatePath } from "next/cache";
import {
  commandeSchema,
  fournisseurSchema,
  paiementDetteSchema,
  receptionSchema,
} from "@/lib/fournisseurs/schemas";
import { supabaseServeur } from "@/lib/supabase/server";
import { messageErreurBase } from "@/server/erreurs";
import { exigerFournisseurs } from "./acces";

const UUID = /^[0-9a-f-]{36}$/i;
const AUCUNE_BOUTIQUE = "Aucune boutique n'est associée à votre compte.";

export type Resultat<T = object> = ({ ok: true } & T) | { ok: false; erreur: string };

export async function enregistrerFournisseurAction(
  entree: unknown,
): Promise<Resultat<{ id: string }>> {
  const { boutiqueId } = await exigerFournisseurs();
  if (!boutiqueId) return { ok: false, erreur: AUCUNE_BOUTIQUE };
  const lu = fournisseurSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0]?.message ?? "Fiche invalide." };
  const f = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("enregistrer_fournisseur", {
    p_boutique: boutiqueId,
    p_id: f.id ?? null,
    p_nom: f.nom,
    p_telephone: f.telephone || null,
    p_adresse: f.adresse || null,
    p_notes: f.notes || null,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/fournisseurs");
  return { ok: true, id: data as string };
}

export async function archiverFournisseurAction(id: string): Promise<Resultat> {
  const { boutiqueId } = await exigerFournisseurs();
  if (!boutiqueId) return { ok: false, erreur: AUCUNE_BOUTIQUE };
  if (!UUID.test(id)) return { ok: false, erreur: "Fournisseur introuvable." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("archiver_fournisseur", { p_boutique: boutiqueId, p_id: id });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/fournisseurs");
  return { ok: true };
}

export async function creerCommandeAction(
  entree: unknown,
): Promise<Resultat<{ commandeId: string; numero: string }>> {
  const { boutiqueId } = await exigerFournisseurs();
  if (!boutiqueId) return { ok: false, erreur: AUCUNE_BOUTIQUE };
  const lu = commandeSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0]?.message ?? "Commande invalide." };
  const c = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("creer_commande", {
    p_boutique: boutiqueId,
    p_cle: c.cle,
    p_fournisseur: c.fournisseurId,
    p_lignes: c.lignes.map((l) => ({
      produit_id: l.produitId,
      unite_id: l.uniteId,
      quantite: l.quantite,
      prix_achat: l.prixAchat,
    })),
    p_note: c.note || null,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/fournisseurs/commandes");
  return { ok: true, commandeId: data.commande_id, numero: data.numero };
}

/** Réception (totale ou partielle) : stock, prix d'achat, dette et paiement comptant en une seule opération. */
export async function receptionnerCommandeAction(
  entree: unknown,
): Promise<Resultat<{ montant: number; prixModifies: number }>> {
  await exigerFournisseurs();
  const lu = receptionSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0]?.message ?? "Réception invalide." };
  const r = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("receptionner_commande", {
    p_commande: r.commandeId,
    p_cle: r.cle,
    p_lignes: r.lignes.map((l) => ({ commande_ligne_id: l.commandeLigneId, quantite: l.quantite })),
    p_paye: r.paye,
    p_mode: r.mode,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/fournisseurs", "layout");
  revalidatePath("/stock");
  return { ok: true, montant: Number(data.montant), prixModifies: Number(data.prix_modifies ?? 0) };
}

export async function annulerCommandeAction(commandeId: string, motif: string): Promise<Resultat> {
  await exigerFournisseurs();
  if (!UUID.test(commandeId)) return { ok: false, erreur: "Commande introuvable." };
  const { error } = await (
    await supabaseServeur()
  ).rpc("annuler_commande", { p_commande: commandeId, p_motif: motif.trim().slice(0, 200) });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/fournisseurs/commandes");
  return { ok: true };
}

export async function payerDetteAction(entree: unknown): Promise<Resultat<{ solde: number }>> {
  await exigerFournisseurs();
  const lu = paiementDetteSchema.safeParse(entree);
  if (!lu.success) return { ok: false, erreur: lu.error.issues[0]?.message ?? "Paiement invalide." };
  const p = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("payer_dette_fournisseur", {
    p_dette: p.detteId,
    p_cle: p.cle,
    p_montant: p.montant,
    p_mode: p.mode,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/fournisseurs", "layout");
  return { ok: true, solde: Number(data.solde) };
}

/** Prix d'achat habituel d'un produit, par unité de vente (prix par unité de base × facteur), pour préremplir la commande. */
export async function lireCoutAction(produitId: string): Promise<number | null> {
  await exigerFournisseurs();
  if (!UUID.test(produitId)) return null;
  const { data } = await (await supabaseServeur())
    .from("produit_couts")
    .select("prix_achat")
    .eq("produit_id", produitId)
    .maybeSingle();
  return data ? Number(data.prix_achat) : null;
}
