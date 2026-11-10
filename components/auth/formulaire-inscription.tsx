"use client";

import { useActionState } from "react";
import { inscrire, type EtatFormulaire } from "@/server/auth/actions";
import { Turnstile } from "../turnstile";
import { BoutonEnvoi } from "./bouton-envoi";
import { Champ } from "./champ";

export function FormulaireInscription({
  codeInitial,
}: {
  codeInitial?: string;
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(inscrire, {});
  const c = etat.champs;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="nomBoutique"
        libelle="Nom de votre boutique"
        autoComplete="organization"
        required
        erreur={c?.nomBoutique}
      />
      <Champ
        nom="ville"
        libelle="Ville"
        autoComplete="address-level2"
        required
        erreur={c?.ville}
      />
      <Champ
        nom="telephone"
        libelle="Numéro WhatsApp"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="699 12 34 56"
        required
        erreur={c?.telephone}
      />
      <Champ
        nom="email"
        libelle="Email"
        type="email"
        autoComplete="email"
        required
        erreur={c?.email}
      />
      <Champ
        nom="motDePasse"
        libelle="Mot de passe"
        type="password"
        autoComplete="new-password"
        required
        aide="8 caractères minimum, avec une lettre et un chiffre."
        erreur={c?.motDePasse}
      />
      <Champ
        nom="codeParrainage"
        libelle="Code de parrainage (facultatif)"
        defaultValue={codeInitial}
        autoCapitalize="characters"
        erreur={c?.codeParrainage}
      />
      <Turnstile />
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Création…">Créer ma boutique</BoutonEnvoi>
    </form>
  );
}
