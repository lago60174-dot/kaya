"use client";

import { useActionState } from "react";
import {
  changerPlanAction,
  decisionDemandeAction,
  modifierPlanAction,
  paiementManuelAction,
  statutAction,
  type EtatAdmin,
} from "@/server/admin/actions";

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";
const bouton = "bg-brand-strong min-h-11 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60";
const boutonContour = "border-border min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold disabled:opacity-60";

function Retour({ etat }: { etat: EtatAdmin }) {
  if (etat.erreur)
    return (
      <p role="alert" className="text-danger text-sm">
        {etat.erreur}
      </p>
    );
  if (etat.ok)
    return (
      <p role="status" className="text-sm font-medium text-emerald-700">
        {etat.ok}
      </p>
    );
  return null;
}

export function FormulairePaiement({ org }: { org: string }) {
  const [etat, action, enCours] = useActionState<EtatAdmin, FormData>(paiementManuelAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="org" value={org} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Type
          <select name="type" className={champ} defaultValue="abonnement">
            <option value="abonnement">Abonnement</option>
            <option value="installation">Frais d&apos;installation</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Durée
          <select name="mois" className={champ} defaultValue="1">
            <option value="1">1 mois</option>
            <option value="12">12 mois</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Montant reçu (FCFA)
          <input name="montant" inputMode="numeric" required className={champ} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Référence (n° de transaction)
          <input name="reference" required maxLength={80} className={champ} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Note (facultatif)
        <input name="note" maxLength={200} className={champ} />
      </label>
      <Retour etat={etat} />
      <button type="submit" disabled={enCours} className={bouton}>
        {enCours ? "Enregistrement…" : "Enregistrer le paiement"}
      </button>
    </form>
  );
}

export function FormulairePlan({ org, plans, actuel }: { org: string; plans: { code: string; nom: string }[]; actuel: string }) {
  const [etat, action, enCours] = useActionState<EtatAdmin, FormData>(changerPlanAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="org" value={org} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Plan
        <select name="plan" className={champ} defaultValue={actuel}>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.nom}
            </option>
          ))}
        </select>
      </label>
      <Retour etat={etat} />
      <button type="submit" disabled={enCours} className={boutonContour}>
        {enCours ? "Un instant…" : "Changer le plan"}
      </button>
    </form>
  );
}

export function FormulaireStatut({ org, statut }: { org: string; statut: string }) {
  const [etat, action, enCours] = useActionState<EtatAdmin, FormData>(statutAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="org" value={org} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Action
          <select name="action" className={champ} defaultValue={statut === "suspendu" || statut === "annule" ? "reactiver" : "suspendre"}>
            <option value="reactiver">Réactiver (jours offerts)</option>
            <option value="suspendre">Suspendre (lecture seule)</option>
            <option value="annuler">Annuler l&apos;abonnement</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Jours offerts (réactivation)
          <input name="jours" inputMode="numeric" defaultValue="7" className={champ} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Motif (facultatif, gardé dans le journal)
        <input name="note" maxLength={200} className={champ} />
      </label>
      <Retour etat={etat} />
      <button type="submit" disabled={enCours} className={boutonContour}>
        {enCours ? "Un instant…" : "Appliquer"}
      </button>
    </form>
  );
}

export function FormulaireModifierPlan({ code, nom, prix, visible }: { code: string; nom: string; prix: number; visible: boolean }) {
  const [etat, action, enCours] = useActionState<EtatAdmin, FormData>(modifierPlanAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <input type="hidden" name="code" value={code} />
      <h2 className="text-lg font-bold">{nom}</h2>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Prix par mois (FCFA)
        <input name="prix" inputMode="numeric" defaultValue={String(prix)} required className={champ} />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="visible" defaultChecked={visible} className="size-5" />
        Visible sur le site et à l&apos;inscription
      </label>
      <Retour etat={etat} />
      <button type="submit" disabled={enCours} className={bouton}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function BoutonsDemande({ id }: { id: string }) {
  const [etat, action, enCours] = useActionState<EtatAdmin, FormData>(decisionDemandeAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" name="statut" value="acceptee" disabled={enCours} className={bouton}>
        Accepter
      </button>
      <button type="submit" name="statut" value="refusee" disabled={enCours} className={boutonContour}>
        Refuser
      </button>
      <Retour etat={etat} />
    </form>
  );
}
