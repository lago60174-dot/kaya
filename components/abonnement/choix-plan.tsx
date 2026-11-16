"use client";

import { useActionState } from "react";
import {
  choisirPlanAction,
  type EtatAbonnementAction,
} from "@/server/abonnement/actions";

export interface OptionPlan {
  code: string;
  nom: string;
  prix: string;
}

export function ChoixPlan({
  options,
  choisi,
}: {
  options: OptionPlan[];
  choisi: string;
}) {
  const [etat, action, enCours] = useActionState<
    EtatAbonnementAction,
    FormData
  >(choisirPlanAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          Plan pour la prochaine période
        </legend>
        {options.map((o) => (
          <label
            key={o.code}
            className="border-border flex min-h-11 items-center gap-3 rounded-lg border px-3"
          >
            <input
              type="radio"
              name="plan"
              value={o.code}
              defaultChecked={o.code === choisi}
            />
            <span className="flex-1 font-medium">{o.nom}</span>
            <span className="text-muted text-sm">{o.prix} / mois</span>
          </label>
        ))}
      </fieldset>
      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <button
        type="submit"
        disabled={enCours}
        className="border-border hover:bg-brand-soft min-h-11 rounded-lg border px-3 text-sm font-medium"
      >
        Enregistrer mon choix
      </button>
    </form>
  );
}
