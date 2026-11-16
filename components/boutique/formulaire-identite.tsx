"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import {
  enregistrerIdentiteAction,
  type EtatIdentite,
} from "@/server/boutique/actions";

export interface IdentiteBoutique {
  ville: string;
  email: string;
  rccm: string;
  niu: string;
  signataire: string;
}

/** Informations légales imprimées sur chaque reçu : elles donnent de la valeur au reçu en cas de litige. */
export function FormulaireIdentite({ valeurs }: { valeurs: IdentiteBoutique }) {
  const [etat, action] = useActionState<EtatIdentite, FormData>(
    enregistrerIdentiteAction,
    {},
  );
  const c = etat.champs ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ nom="ville" libelle="Ville" defaultValue={valeurs.ville} erreur={c.ville} />
      <Champ
        nom="email"
        libelle="Email de la boutique"
        type="email"
        defaultValue={valeurs.email}
        erreur={c.email}
      />
      <Champ
        nom="rccm"
        libelle="Numéro RCCM (registre du commerce)"
        defaultValue={valeurs.rccm}
        erreur={c.rccm}
      />
      <Champ
        nom="niu"
        libelle="Numéro de contribuable (NIU)"
        defaultValue={valeurs.niu}
        erreur={c.niu}
      />
      <Champ
        nom="signataire"
        libelle="Nom du signataire"
        defaultValue={valeurs.signataire}
        erreur={c.signataire}
        aide="Imprimé sous la signature, par exemple « M. Nkou, gérant »."
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
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer ces informations</BoutonEnvoi>
    </form>
  );
}
