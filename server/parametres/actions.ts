"use server";

import { revalidatePath } from "next/cache";
import { parametresSchema } from "@/lib/parametres/schemas";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";

export interface EtatParametres {
  erreur?: string;
  champs?: Record<string, string>;
  succes?: string;
}

/** Enregistre les réglages de la boutique. La base vérifie le rôle, la lecture seule, les bornes, et écrit le journal. */
export async function enregistrerParametresAction(
  _e: EtatParametres,
  formData: FormData,
): Promise<EtatParametres> {
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return {
      erreur: "Impossible de charger votre boutique. Reconnectez-vous.",
    };

  const lu = parametresSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) {
    const champs: Record<string, string> = {};
    for (const i of lu.error.issues) champs[String(i.path[0])] ??= i.message;
    return { erreur: "Corrigez les champs signalés.", champs };
  }
  const p = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("modifier_parametres_boutique", {
    p_boutique: boutiqueId,
    p_nom: p.nom,
    p_adresse: p.adresse ?? "",
    p_telephone: p.telephone ?? "",
    p_mention_legale: p.mentionLegale ?? "",
    p_seuil_remise: p.seuilRemise,
    p_plafond_credit: p.plafondCredit,
    p_stock_negatif: p.stockNegatif,
    p_ecart_tolere: p.ecartTolere,
  });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath("/parametres");
  const modifie = (data as { modifie?: boolean } | null)?.modifie;
  return {
    succes: modifie
      ? "Paramètres enregistrés."
      : "Rien à changer : tout est déjà à jour.",
  };
}
