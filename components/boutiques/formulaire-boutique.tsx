"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import { creerBoutiqueAction, type EtatBoutique } from "@/server/boutique/actions";

export function FormulaireBoutique() {
  const [etat, action] = useActionState<EtatBoutique, FormData>(
    creerBoutiqueAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ nom="nom" libelle="Nom de la nouvelle boutique" required maxLength={80} erreur={etat.champs?.nom} />
      <Champ nom="adresse" libelle="Adresse (facultatif)" maxLength={200} erreur={etat.champs?.adresse} />
      <Champ nom="telephone" libelle="Téléphone (facultatif)" type="tel" inputMode="tel" maxLength={30} erreur={etat.champs?.telephone} />
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {etat.succes}
        </p>
      )}
      <BoutonEnvoi enCours="Création…">Ajouter la boutique</BoutonEnvoi>
    </form>
  );
}
