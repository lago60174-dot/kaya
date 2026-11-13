"use server";

import { revalidatePath } from "next/cache";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { bucketImages } from "@/server/images/bucket";
import { cleAppartient } from "@/server/images/cles";
import { verifierImageStockee } from "@/server/images/verification";

export interface EtatLogo {
  erreur?: string;
}

/**
 * Enregistre (ou retire, avec `null`) le logo de la boutique. Propriétaire seulement.
 * Le fichier envoyé est recontrôlé côté serveur : clé de son organisation, taille et signature PNG.
 */
export async function definirLogoAction(cle: string | null): Promise<EtatLogo> {
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueIds[0];
  if (!profil.organisationId || !boutiqueId)
    return {
      erreur: "Impossible de charger votre boutique. Reconnectez-vous.",
    };
  if (cle !== null) {
    if (!cleAppartient(cle, profil.organisationId, "logo"))
      return { erreur: "Logo invalide. Choisissez une autre image." };
    const bucket = bucketImages();
    if (!bucket)
      return { erreur: "L'envoi des images n'est pas encore configuré." };
    const controle = await verifierImageStockee(bucket, cle, "logo");
    if (!controle.ok)
      return { erreur: "Ce logo n'a pas pu être enregistré. Réessayez." };
  }
  const { error } = await (
    await supabaseServeur()
  )
    .from("boutiques")
    .update({ logo_cle: cle })
    .eq("id", boutiqueId);
  if (error)
    return { erreur: "Le logo n'a pas pu être enregistré. Réessayez." };
  revalidatePath("/parametres");
  return {};
}
