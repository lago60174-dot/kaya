"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";
import { bucketImages } from "@/server/images/bucket";
import { cleAppartient } from "@/server/images/cles";
import { verifierImageStockee } from "@/server/images/verification";

export interface EtatLogo {
  erreur?: string;
}

type TypeMarque = "logo" | "signature" | "cachet";

/**
 * Enregistre (ou retire, avec `null`) le logo, la signature ou le cachet de la boutique. Propriétaire seulement.
 * Le fichier envoyé est recontrôlé côté serveur : clé de son organisation, taille et signature PNG.
 */
export async function definirImageBoutiqueAction(
  type: TypeMarque,
  cle: string | null,
): Promise<EtatLogo> {
  if (!["logo", "signature", "cachet"].includes(type))
    return { erreur: "Image invalide." };
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueIds[0];
  if (!profil.organisationId || !boutiqueId)
    return {
      erreur: "Impossible de charger votre boutique. Reconnectez-vous.",
    };
  if (cle !== null) {
    if (!cleAppartient(cle, profil.organisationId, type))
      return { erreur: "Image invalide. Choisissez-en une autre." };
    const bucket = bucketImages();
    if (!bucket)
      return { erreur: "L'envoi des images n'est pas encore configuré." };
    const controle = await verifierImageStockee(bucket, cle, type);
    if (!controle.ok)
      return { erreur: "Cette image n'a pas pu être enregistrée. Réessayez." };
  }
  const supabase = await supabaseServeur();
  // Écriture par fonction atomique : le propriétaire, la lecture seule et le journal sont contrôlés en base.
  const { error } =
    type === "logo"
      ? await supabase.rpc("definir_logo_boutique", {
          p_boutique: boutiqueId,
          p_cle: cle,
        })
      : await supabase.rpc("definir_image_boutique", {
          p_boutique: boutiqueId,
          p_type: type,
          p_cle: cle,
        });
  if (error)
    return { erreur: "L'image n'a pas pu être enregistrée. Réessayez." };
  revalidatePath("/parametres");
  return {};
}

export interface EtatIdentite {
  erreur?: string;
  champs?: Record<string, string>;
  succes?: string;
}

const identiteSchema = z.object({
  ville: z.string().trim().max(60, "60 caractères maximum."),
  email: z
    .string()
    .trim()
    .max(120, "120 caractères maximum.")
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: "Adresse email invalide.",
    }),
  rccm: z.string().trim().max(40, "40 caractères maximum."),
  niu: z.string().trim().max(40, "40 caractères maximum."),
  signataire: z.string().trim().max(80, "80 caractères maximum."),
});

/** Identité légale de la boutique, imprimée sur les reçus : ville, email, RCCM, numéro de contribuable, signataire. */
export async function enregistrerIdentiteAction(
  _e: EtatIdentite,
  formData: FormData,
): Promise<EtatIdentite> {
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return { erreur: "Impossible de charger votre boutique. Reconnectez-vous." };
  const lu = identiteSchema.safeParse(
    Object.fromEntries(
      ["ville", "email", "rccm", "niu", "signataire"].map((k) => [
        k,
        String(formData.get(k) ?? ""),
      ]),
    ),
  );
  if (!lu.success) {
    const champs: Record<string, string> = {};
    for (const i of lu.error.issues) champs[String(i.path[0])] ??= i.message;
    return { erreur: "Corrigez les champs signalés.", champs };
  }
  const { error, data } = await (
    await supabaseServeur()
  ).rpc("modifier_identite_boutique", {
    p_boutique: boutiqueId,
    p_ville: lu.data.ville,
    p_email: lu.data.email,
    p_rccm: lu.data.rccm,
    p_niu: lu.data.niu,
    p_signataire: lu.data.signataire,
  });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath("/parametres");
  return {
    succes: (data as { modifie?: boolean } | null)?.modifie
      ? "Informations enregistrées."
      : "Rien à changer : tout est déjà à jour.",
  };
}
