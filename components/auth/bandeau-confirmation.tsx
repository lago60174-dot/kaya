"use client";

import { useActionState } from "react";
import {
  renvoyerConfirmationAction,
  type EtatEmail,
} from "@/server/auth/emails";

/** Rappel discret tant que l'adresse email du propriétaire n'est pas confirmée (utile pour récupérer son compte). */
export function BandeauConfirmation() {
  const [etat, action, enCours] = useActionState<EtatEmail, FormData>(
    async () => renvoyerConfirmationAction(),
    {},
  );
  return (
    <div role="status" className="kaya-bandeau-email">
      <span>
        {etat.succes ??
          etat.erreur ??
          "Confirmez votre adresse email pour pouvoir récupérer votre compte si vous oubliez votre mot de passe."}
      </span>
      {!etat.succes && (
        <form action={action}>
          <button type="submit" disabled={enCours}>
            {enCours ? "Envoi…" : "Envoyer l'email"}
          </button>
        </form>
      )}
    </div>
  );
}
