"use client";

import { useActionState } from "react";
import { connecter, type EtatFormulaire } from "@/server/auth/actions";
import { BoutonEnvoi } from "./bouton-envoi";
import { Champ } from "./champ";

export function FormulaireConnexion() {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(
    connecter,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="email"
        libelle="Email"
        type="email"
        autoComplete="email"
        required
        erreur={etat.champs?.email}
      />
      <Champ
        nom="motDePasse"
        libelle="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        erreur={etat.champs?.motDePasse}
      />
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Connexion…">Se connecter</BoutonEnvoi>
    </form>
  );
}
