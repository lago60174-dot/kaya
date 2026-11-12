"use server";

import { revalidatePath } from "next/cache";
import { versProduitsVente } from "@/lib/ventes/produits";
import { clientRapideSchema, venteSchema } from "@/lib/ventes/schemas";
import type { ProduitVente } from "@/lib/ventes/panier";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";
import { listerProduits } from "@/server/stock/lecture";

export type ResultatVente =
  | { ok: true; venteId: string; numeroRecu: string; dejaEnregistree: boolean }
  | { ok: false; erreur: string };

export interface ClientTrouve {
  id: string;
  nom: string;
  telephone: string | null;
}

/** Valide la vente. Les prix, remises et totaux sont recalculés par la base : seuls les identifiants et quantités comptent. */
export async function validerVenteAction(
  entree: unknown,
): Promise<ResultatVente> {
  const profil = await exigerRole("boutique");
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return {
      ok: false,
      erreur: "Aucune boutique n'est associée à votre compte.",
    };
  const lu = venteSchema.safeParse(entree);
  if (!lu.success)
    return {
      ok: false,
      erreur: lu.error.issues[0]?.message ?? "Vente invalide.",
    };
  const d = lu.data;

  const supabase = await supabaseServeur();
  const { data, error } = await supabase.rpc("creer_vente", {
    p_boutique: boutiqueId,
    p_cle: d.cle,
    p_lignes: d.lignes.map((l) => ({
      produit_id: l.produitId,
      unite_id: l.uniteId,
      quantite: l.quantite,
      remise_ligne: l.remiseLigne,
    })),
    p_paiements: d.paiements,
    p_client: d.clientId ?? null,
    p_remise: d.remise,
    p_forcer: d.forcer,
  });
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/stock");
  return {
    ok: true,
    venteId: data.vente_id,
    numeroRecu: data.numero_recu,
    dejaEnregistree: data.deja_enregistree === true,
  };
}

export async function chercherProduitsVenteAction(
  recherche: string,
): Promise<ProduitVente[]> {
  const profil = await exigerRole("boutique");
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId) return [];
  const page = await listerProduits(await supabaseServeur(), boutiqueId, {
    recherche: recherche.slice(0, 60),
  });
  return versProduitsVente(page.produits);
}

/** Retire les caractères qui ont un sens dans un filtre PostgREST. */
const nettoyer = (t: string) =>
  t
    .replace(/[,()%*\\"]/g, " ")
    .trim()
    .slice(0, 40);

export async function chercherClientsAction(
  recherche: string,
): Promise<ClientTrouve[]> {
  await exigerRole("boutique");
  const q = nettoyer(recherche);
  if (q.length < 2) return [];
  const { data } = await (
    await supabaseServeur()
  )
    .from("clients")
    .select("id, nom, telephone")
    .is("archive_le", null)
    .or(`nom.ilike.%${q}%,telephone.ilike.%${q}%`)
    .order("nom")
    .limit(8);
  return data ?? [];
}

export async function creerClientRapideAction(
  entree: unknown,
): Promise<{ ok: true; client: ClientTrouve } | { ok: false; erreur: string }> {
  const profil = await exigerRole("boutique");
  if (!profil.organisationId)
    return { ok: false, erreur: "Impossible de charger votre compte." };
  const lu = clientRapideSchema.safeParse(entree);
  if (!lu.success)
    return {
      ok: false,
      erreur: lu.error.issues[0]?.message ?? "Client invalide.",
    };
  // Le vendeur ne fixe pas de plafond de crédit : c'est la règle du propriétaire (et la RLS le vérifie).
  const { data, error } = await (
    await supabaseServeur()
  )
    .from("clients")
    .insert({
      organisation_id: profil.organisationId,
      nom: lu.data.nom,
      telephone: lu.data.telephone ?? null,
    })
    .select("id, nom, telephone")
    .single();
  if (error || !data) return { ok: false, erreur: messageErreurBase(error) };
  return { ok: true, client: data };
}

export interface EtatAnnulation {
  erreur?: string;
  succes?: string;
}

/** Annule une vente par un avoir (propriétaire uniquement, motif obligatoire). Le reçu d'origine reste visible, marqué ANNULÉ. */
export async function annulerVenteAction(
  _e: EtatAnnulation,
  formData: FormData,
): Promise<EtatAnnulation> {
  await exigerRole("proprietaire");
  const venteId = String(formData.get("venteId") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(venteId))
    return { erreur: "Vente introuvable." };
  if (!motif) return { erreur: "Indiquez le motif de l'annulation." };
  if (motif.length > 200)
    return { erreur: "Ce motif est trop long (200 caractères maximum)." };
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("annuler_vente", { p_vente: venteId, p_motif: motif });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath(`/vente/recu/${venteId}`);
  revalidatePath("/recus");
  revalidatePath("/stock");
  return {
    succes: `Vente annulée. Avoir ${data?.avoir ?? ""} créé, stock remis.`,
  };
}
