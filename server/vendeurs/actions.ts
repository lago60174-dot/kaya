"use server";

import { revalidatePath } from "next/cache";
import { supabaseServeur } from "@/lib/supabase/server";
import { messageErreurBase } from "@/server/erreurs";
import { exigerRole } from "@/server/auth/session";
import { portAdminSupabase } from "./adapter";
import {
  changerEtatVendeur,
  creerVendeur,
  reinitialiserMotDePasseVendeur,
  type ContexteProprietaire,
} from "./service";

export interface EtatVendeur {
  erreur?: string;
  champs?: Record<string, string>;
  identifiants?: { email?: string; motDePasse: string };
  succes?: string;
}

/** Contexte vérifié côté serveur : rôle propriétaire, organisation, plan, nombre de vendeurs actifs. */
async function contexte(
  boutiquesChoisies?: string[],
): Promise<ContexteProprietaire | null> {
  const profil = await exigerRole("proprietaire");
  if (!profil.organisationId || !profil.plan) return null;
  const supabase = await supabaseServeur();
  const { count } = await supabase
    .from("membres")
    .select("id", { count: "exact", head: true })
    .eq("role", "vendeur")
    .eq("actif", true);
  return {
    organisationId: profil.organisationId,
    // Boutiques attribuées au nouveau vendeur : celles cochées, parmi celles du propriétaire ; à défaut, la boutique active.
    boutiqueIds: (() => {
      const choisies = (boutiquesChoisies ?? []).filter((id) =>
        profil.boutiqueIds.includes(id),
      );
      if (choisies.length > 0) return choisies;
      return profil.boutiqueActiveId ? [profil.boutiqueActiveId] : [];
    })(),
    plan: profil.plan,
    vendeursActifs: count ?? 0,
  };
}

const ERREUR = "Impossible de charger votre compte. Reconnectez-vous.";
const aleatoire = () => crypto.getRandomValues(new Uint8Array(16));

export async function creerVendeurAction(
  _e: EtatVendeur,
  formData: FormData,
): Promise<EtatVendeur> {
  const ctx = await contexte(formData.getAll("boutiques").map(String));
  if (!ctx) return { erreur: ERREUR };
  if (ctx.boutiqueIds.length === 0) return { erreur: ERREUR };
  const r = await creerVendeur(
    portAdminSupabase(),
    ctx,
    Object.fromEntries(formData),
    aleatoire(),
  );
  if (!r.ok) return { erreur: r.erreur, champs: r.champs };
  revalidatePath("/parametres");
  return {
    identifiants: { email: r.email, motDePasse: r.motDePasseProvisoire },
  };
}

export async function basculerVendeurAction(
  _e: EtatVendeur,
  formData: FormData,
): Promise<EtatVendeur> {
  const ctx = await contexte();
  if (!ctx) return { erreur: ERREUR };
  const r = await changerEtatVendeur(
    portAdminSupabase(),
    ctx,
    String(formData.get("membreId")),
    formData.get("actif") === "true",
  );
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/parametres");
  return { succes: "Modification enregistrée." };
}

export async function reinitialiserVendeurAction(
  _e: EtatVendeur,
  formData: FormData,
): Promise<EtatVendeur> {
  const ctx = await contexte();
  if (!ctx) return { erreur: ERREUR };
  const r = await reinitialiserMotDePasseVendeur(
    portAdminSupabase(),
    ctx,
    String(formData.get("membreId")),
    aleatoire(),
  );
  return r.ok
    ? { identifiants: { motDePasse: r.motDePasseProvisoire } }
    : { erreur: r.erreur };
}

/** Change les boutiques dans lesquelles un vendeur peut travailler. La base vérifie le rôle et l'organisation. */
export async function definirBoutiquesVendeurAction(
  _e: EtatVendeur,
  formData: FormData,
): Promise<EtatVendeur> {
  await exigerRole("proprietaire");
  const { error } = await (
    await supabaseServeur()
  ).rpc("definir_boutiques_vendeur", {
    p_membre: String(formData.get("membreId")),
    p_boutiques: formData.getAll("boutiques").map(String),
  });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath("/parametres");
  return { succes: "Boutiques du vendeur enregistrées." };
}
