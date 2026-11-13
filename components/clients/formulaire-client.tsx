"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import { formatFcfa } from "@/lib/format";
import {
  enregistrerClientAction,
  type EtatClient,
} from "@/server/clients/actions";

interface Props {
  initial?: {
    id?: string;
    nom?: string;
    telephone?: string | null;
    notes?: string | null;
    plafondCredit?: number | null;
  };
  /** Réservé au propriétaire. */
  peutFixerPlafond: boolean;
  plafondParDefaut: number;
}

export function FormulaireClient({
  initial = {},
  peutFixerPlafond,
  plafondParDefaut,
}: Props) {
  const [etat, action] = useActionState<EtatClient, FormData>(
    enregistrerClientAction,
    {},
  );
  const c = etat.champs;
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <Champ
        nom="nom"
        libelle="Nom du client"
        defaultValue={initial.nom}
        required
        erreur={c?.nom}
      />
      <Champ
        nom="telephone"
        libelle="Téléphone / WhatsApp (facultatif)"
        type="tel"
        inputMode="tel"
        defaultValue={initial.telephone ?? ""}
        placeholder="699 12 34 56"
        erreur={c?.telephone}
        aide="Sert aux rappels WhatsApp."
      />
      {peutFixerPlafond && (
        <Champ
          nom="plafondCredit"
          libelle="Plafond de crédit (FCFA)"
          inputMode="numeric"
          defaultValue={initial.plafondCredit ?? ""}
          erreur={c?.plafondCredit}
          aide={`Laissez vide pour le plafond de la boutique (${formatFcfa(plafondParDefaut)}).`}
        />
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes (facultatif)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial.notes ?? ""}
          className="border-border rounded-lg border bg-white px-3 py-2 text-base"
        />
        {c?.notes && <p className="text-danger text-sm">{c.notes}</p>}
      </div>
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer le client</BoutonEnvoi>
    </form>
  );
}
