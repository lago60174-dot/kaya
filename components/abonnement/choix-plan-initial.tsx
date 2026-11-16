"use client";

import { useActionState, useState } from "react";
import {
  choisirPlanInitialAction,
  type EtatAbonnementAction,
} from "@/server/abonnement/actions";

export interface PlanAChoisir {
  code: string;
  nom: string;
  prix: string;
  lignes: { texte: string; bientot: boolean }[];
}

/** Aucune formule n'est cochée au départ : le propriétaire doit en choisir une, le bouton reste fermé sinon. */
export function ChoixPlanInitial({ plans }: { plans: PlanAChoisir[] }) {
  const [choisi, setChoisi] = useState<string | null>(null);
  const [etat, action, enCours] = useActionState<EtatAbonnementAction, FormData>(
    choisirPlanInitialAction,
    {},
  );
  const plan = plans.find((p) => p.code === choisi);
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Formule</legend>
        {plans.map((p) => (
          <label
            key={p.code}
            className={`flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 ${
              choisi === p.code ? "border-brand-strong bg-brand-soft" : "border-border"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="plan"
                value={p.code}
                checked={choisi === p.code}
                onChange={() => setChoisi(p.code)}
                className="size-5"
                required
              />
              <span className="flex-1 text-lg font-bold">{p.nom}</span>
              <span className="font-bold">{p.prix} / mois</span>
            </span>
            <ul className="text-muted flex list-disc flex-col gap-0.5 pl-12 text-sm">
              <li>Stock, ventes, crédits clients et caisse</li>
              <li>Reçus numérotés à partager sur WhatsApp</li>
              {p.lignes.map((l) => (
                <li key={l.texte}>
                  {l.texte}
                  {l.bientot && " (bientôt disponible)"}
                </li>
              ))}
            </ul>
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
        disabled={!plan || enCours}
        className="bg-brand-strong min-h-12 rounded-lg px-4 font-semibold text-white disabled:opacity-50"
      >
        {enCours
          ? "Enregistrement…"
          : plan
            ? `Continuer avec ${plan.nom}`
            : "Choisissez une formule pour continuer"}
      </button>
    </form>
  );
}
