"use client";

import { useActionState } from "react";
import {
  annulerVenteAction,
  type EtatAnnulation,
} from "@/server/ventes/actions";

/** Annulation par avoir, réservée au propriétaire. Une confirmation évite le faux pas. */
export function AnnulerVente({
  venteId,
  numero,
}: {
  venteId: string;
  numero: string;
}) {
  const [etat, action, enCours] = useActionState<EtatAnnulation, FormData>(
    annulerVenteAction,
    {},
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Annuler le reçu ${numero} ? Un avoir sera créé et le stock remis. Le reçu restera visible, marqué ANNULÉ.`,
          )
        )
          e.preventDefault();
      }}
      className="border-danger flex max-w-md flex-col gap-2 rounded-lg border p-3"
    >
      <h2 className="text-danger font-semibold">Annuler cette vente</h2>
      <input type="hidden" name="venteId" value={venteId} />
      <label htmlFor="motif" className="text-sm font-medium">
        Motif (obligatoire)
      </label>
      <input
        id="motif"
        name="motif"
        required
        maxLength={200}
        placeholder="Ex. : erreur de saisie, client parti"
        className="border-border min-h-11 rounded-lg border bg-white px-3 text-base"
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
      <button
        type="submit"
        disabled={enCours}
        className="border-danger text-danger min-h-11 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60"
      >
        {enCours ? "Annulation…" : "Annuler la vente"}
      </button>
    </form>
  );
}
