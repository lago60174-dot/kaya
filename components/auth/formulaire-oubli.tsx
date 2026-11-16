"use client";

import { useActionState } from "react";
import {
  demanderReinitialisationAction,
  type EtatEmail,
} from "@/server/auth/emails";
import { BoutonEnvoi } from "./bouton-envoi";
import { Champ } from "./champ";

export function FormulaireOubli() {
  const [etat, action] = useActionState<EtatEmail, FormData>(
    demanderReinitialisationAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="email"
        libelle="Email de votre compte"
        type="email"
        autoComplete="email"
        required
      />
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="text-success text-sm">
          {etat.succes}
        </p>
      )}
      <BoutonEnvoi enCours="Envoi…">Recevoir le lien</BoutonEnvoi>
    </form>
  );
}
