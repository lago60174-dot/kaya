"use client";

import { useActionState } from "react";
import { inscrire, type EtatFormulaire } from "@/server/auth/actions";
import { BoutonEnvoi } from "./bouton-envoi";
import { Champ } from "./champ";

export interface OptionPlanInscription {
  code: string;
  nom: string;
  prix: string;
}

export function FormulaireInscription({
  codeInitial,
  plan,
  plans = [],
}: {
  codeInitial?: string;
  plan?: string;
  plans?: OptionPlanInscription[];
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(inscrire, {});
  const c = etat.champs;
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Votre plan (vous pourrez payer plus tard)
        </legend>
        {plans.map((o) => (
          <label
            key={o.code}
            className="border-border flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3"
          >
            <input
              type="radio"
              name="plan"
              value={o.code}
              defaultChecked={o.code === plan}
              required
            />
            <span className="flex-1 font-medium">{o.nom}</span>
            <span className="text-muted text-sm">{o.prix} / mois</span>
          </label>
        ))}
        {c?.plan && (
          <p role="alert" className="text-danger text-sm">
            {c.plan}
          </p>
        )}
      </fieldset>
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
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Création…">Créer ma boutique</BoutonEnvoi>
    </form>
  );
}
