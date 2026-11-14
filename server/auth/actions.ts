"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { COOKIE_PARRAINAGE, normaliserCode } from "@/lib/auth/parrainage";
import {
  changerMotDePasseSchema,
  connexionSchema,
  inscriptionSchema,
} from "@/lib/auth/schemas";
import { accueilPour } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServeur } from "@/lib/supabase/server";
import { chargerProfil } from "./profil";
import { exigerRole } from "./session";

export interface EtatFormulaire {
  erreur?: string;
  champs?: Record<string, string>;
}

const ERREUR_GENERIQUE = "Une erreur est survenue. Réessayez dans un instant.";

function champsEnErreur(erreur: z.ZodError): EtatFormulaire {
  const champs: Record<string, string> = {};
  for (const i of erreur.issues) champs[String(i.path[0])] ??= i.message;
  return { erreur: "Vérifiez les champs en rouge.", champs };
}

export async function inscrire(
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const lu = inscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) return champsEnErreur(lu.error);
  const d = lu.data;

  // Parrainage : le code saisi gagne, sinon le cookie posé par le lien /a/CODE (premier contact).
  const cookieCode = (await cookies()).get(COOKIE_PARRAINAGE)?.value;
  const code =
    d.codeParrainage ?? (cookieCode ? normaliserCode(cookieCode) : null);

  const admin = supabaseAdmin();
  const { data: cree, error: erreurCreation } =
    await admin.auth.admin.createUser({
      email: d.email,
      password: d.motDePasse,
      email_confirm: true,
    });
  if (erreurCreation || !cree.user) {
    return erreurCreation?.code === "email_exists"
      ? {
          erreur: "Un compte existe déjà avec cet email. Connectez-vous.",
          champs: { email: "Cet email est déjà utilisé." },
        }
      : { erreur: ERREUR_GENERIQUE };
  }

  const supabase = await supabaseServeur();
  const { error: erreurConnexion } = await supabase.auth.signInWithPassword({
    email: d.email,
    password: d.motDePasse,
  });
  const { error: erreurOrganisation } = erreurConnexion
    ? { error: erreurConnexion }
    : await supabase.rpc("creer_organisation", {
        p_nom: d.nomBoutique,
        p_nom_boutique: d.nomBoutique,
        p_ville: d.ville,
        p_telephone: d.telephone,
        p_code_parrainage: code,
        p_source: d.codeParrainage ? "code" : "lien",
      });
  if (erreurOrganisation) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(cree.user.id); // pas de compte sans boutique
    return {
      erreur:
        erreurOrganisation.code === "P0001"
          ? erreurOrganisation.message
          : ERREUR_GENERIQUE,
    };
  }
  redirect("/patron");
}

export async function connecter(
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const lu = connexionSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) return champsEnErreur(lu.error);

  const supabase = await supabaseServeur();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: lu.data.email,
    password: lu.data.motDePasse,
  });
  // Même message pour un mauvais email ou un mauvais mot de passe.
  if (error || !data.user)
    return { erreur: "Email ou mot de passe incorrect." };

  const profil = await chargerProfil(supabase, data.user);
  if (profil.role === null) {
    await supabase.auth.signOut();
    return {
      erreur:
        "Ce compte est désactivé ou n'est pas encore validé. Contactez votre patron.",
    };
  }
  redirect(
    profil.doitChangerMotDePasse ? "/mot-de-passe" : accueilPour(profil.role),
  );
}

export async function deconnecter(): Promise<void> {
  const supabase = await supabaseServeur();
  await supabase.auth.signOut();
  redirect("/connexion");
}

export async function changerMotDePasseProvisoire(
  _etat: EtatFormulaire,
  formData: FormData,
): Promise<EtatFormulaire> {
  const profil = await exigerRole("connecte");
  const lu = changerMotDePasseSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) return champsEnErreur(lu.error);

  const supabase = await supabaseServeur();
  const { error } = await supabase.auth.updateUser({
    password: lu.data.nouveau,
  });
  if (error)
    return {
      erreur:
        "Ce mot de passe n'a pas pu être enregistré. Choisissez-en un autre.",
    };
  await supabaseAdmin().auth.admin.updateUserById(profil.userId, {
    app_metadata: { doit_changer_mot_de_passe: false },
  });
  redirect(accueilPour(profil.role ?? "vendeur"));
}
