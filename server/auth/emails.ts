"use server";

import { z } from "zod";
import { exigerRole } from "@/server/auth/session";
import {
  emailConfirmation,
  emailReinitialisation,
} from "@/server/email/modeles";
import { emailConfigure, envoyerEmail } from "@/server/email/resend";
import { fabriquerLienEmail } from "@/server/email/liens";

export interface EtatEmail {
  erreur?: string;
  succes?: string;
}

const emailSchema = z.object({ email: z.email().max(160) });

/** « Mot de passe oublié ». Même réponse que le compte existe ou non : on ne révèle jamais qui est inscrit. */
export async function demanderReinitialisationAction(
  _e: EtatEmail,
  formData: FormData,
): Promise<EtatEmail> {
  const lu = emailSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!lu.success) return { erreur: "Saisissez une adresse email valide." };
  if (!emailConfigure())
    return {
      erreur:
        "L'envoi d'emails n'est pas encore activé. Contactez le support Kaya pour changer votre mot de passe.",
    };
  const lien = await fabriquerLienEmail(lu.data.email, "recovery", "/mot-de-passe");
  if (lien) await envoyerEmail(emailReinitialisation({ a: lu.data.email, lien }));
  return {
    succes:
      "Si un compte existe avec cette adresse, un email vient d'être envoyé. Pensez à regarder dans vos courriers indésirables.",
  };
}

/** Renvoie l'email de confirmation au propriétaire connecté. */
export async function renvoyerConfirmationAction(): Promise<EtatEmail> {
  const profil = await exigerRole("proprietaire");
  if (!emailConfigure())
    return { erreur: "L'envoi d'emails n'est pas encore activé." };
  const lien = await fabriquerLienEmail(profil.email, "magiclink", "/patron");
  if (!lien) return { erreur: "L'email n'a pas pu être préparé. Réessayez." };
  const ok = await envoyerEmail(emailConfirmation({ a: profil.email, lien }));
  return ok
    ? { succes: "Email envoyé. Ouvrez-le pour confirmer votre adresse." }
    : { erreur: "L'email n'a pas pu être envoyé. Réessayez dans un instant." };
}
