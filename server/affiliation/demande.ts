"use server";

import { demandePartenaireSchema } from "@/lib/affiliation/schemas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  champsEnErreur,
  ERREUR_GENERIQUE,
  type EtatFormulaire,
} from "../formulaires";

export interface EtatDemandePartenaire extends EtatFormulaire {
  envoyee?: boolean;
}

/**
 * Demande « Devenir partenaire ». Aucune création de compte : l'administrateur valide à la main (étape 20).
 * La réponse est la même pour une nouvelle demande et pour un doublon, pour ne pas révéler quels numéros sont connus.
 */
export async function demanderPartenariat(
  _etat: EtatDemandePartenaire,
  formData: FormData,
): Promise<EtatDemandePartenaire> {
  const lu = demandePartenaireSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) return champsEnErreur(lu.error);

  const { error } = await supabaseAdmin().rpc("demander_partenariat", {
    p_nom: lu.data.nom,
    p_telephone: lu.data.telephone,
    p_mode: lu.data.modeVersement,
  });
  if (error) {
    console.error("demande partenaire refusée par la base", error.code);
    return { erreur: ERREUR_GENERIQUE };
  }
  return { envoyee: true };
}
