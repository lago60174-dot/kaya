"use client";

import { useActionState } from "react";
import {
  changerMotDePasseProvisoire,
  type EtatFormulaire,
} from "@/server/auth/actions";
import { BoutonEnvoi } from "./bouton-envoi";
import { Champ } from "./champ";

export function FormulaireMotDePasse() {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(
    changerMotDePasseProvisoire,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="nouveau"
        libelle="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        aide="8 caractères minimum, avec une lettre et un chiffre."
        erreur={etat.champs?.nouveau}
      />
      <Champ
        nom="confirmation"
        libelle="Répétez le mot de passe"
        type="password"
        autoComplete="new-password"
        required
        erreur={etat.champs?.confirmation}
      />
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}
