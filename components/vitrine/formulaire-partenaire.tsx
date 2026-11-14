"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import {
  LIBELLE_MODE_VERSEMENT,
  MODES_VERSEMENT,
} from "@/lib/affiliation/schemas";
import {
  demanderPartenariat,
  type EtatDemandePartenaire,
} from "@/server/affiliation/demande";

export function FormulairePartenaire() {
  const [etat, action] = useActionState<EtatDemandePartenaire, FormData>(
    demanderPartenariat,
    {},
  );

  if (etat.envoyee) {
    return (
      <div role="status" className="border-goudron border-2 bg-white p-6">
        <p className="font-affiche text-3xl">Demande reçue.</p>
        <p className="text-terre mt-2 text-lg">
          Nous étudions votre demande et nous vous répondons sur WhatsApp. Aucun
          lien de parrainage n&apos;est actif avant cette réponse.
        </p>
      </div>
    );
  }

  const c = etat.champs;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="nom"
        idChamp="partenaire-nom"
        libelle="Votre nom"
        autoComplete="name"
        required
        erreur={c?.nom}
      />
      <Champ
        nom="telephone"
        idChamp="partenaire-telephone"
        libelle="Votre numéro WhatsApp"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="699 12 34 56"
        required
        erreur={c?.telephone}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          Où voulez-vous recevoir vos commissions ?
        </legend>
        <div className="flex flex-wrap gap-3">
          {MODES_VERSEMENT.map((mode, i) => (
            <label
              key={mode}
              className="border-goudron has-checked:bg-goudron flex min-h-11 cursor-pointer items-center gap-2 border-2 bg-white px-4 font-bold has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2"
            >
              <input
                type="radio"
                name="modeVersement"
                value={mode}
                defaultChecked={i === 0}
                className="size-4 min-h-0 accent-current"
              />
              {LIBELLE_MODE_VERSEMENT[mode]}
            </label>
          ))}
        </div>
        {c?.modeVersement && (
          <p className="text-danger text-sm">{c.modeVersement}</p>
        )}
      </fieldset>
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Envoi…">Envoyer ma demande</BoutonEnvoi>
    </form>
  );
}
