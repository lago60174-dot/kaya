"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import {
  creerVendeurAction,
  type EtatVendeur,
} from "@/server/vendeurs/actions";
import type { BoutiqueAccessible } from "@/lib/boutiques/active";
import { CasesBoutiques } from "./cases-boutiques";
import { IdentifiantsProvisoires } from "./identifiants";

export function FormulaireVendeur({
  boutiques = [],
  boutiqueActiveId,
}: {
  boutiques?: BoutiqueAccessible[];
  boutiqueActiveId?: string;
}) {
  const [etat, action] = useActionState<EtatVendeur, FormData>(
    creerVendeurAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Champ
        nom="nom"
        libelle="Nom du vendeur"
        required
        erreur={etat.champs?.nom}
      />
      <Champ
        nom="email"
        libelle="Email du vendeur"
        type="email"
        required
        erreur={etat.champs?.email}
      />
      {boutiques.length > 1 && (
        <CasesBoutiques
          boutiques={boutiques}
          cochees={boutiqueActiveId ? [boutiqueActiveId] : []}
          idPrefixe="nouveau-vendeur"
        />
      )}
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      {etat.identifiants && <IdentifiantsProvisoires {...etat.identifiants} />}
      <BoutonEnvoi enCours="Création…">Créer le compte vendeur</BoutonEnvoi>
    </form>
  );
}
