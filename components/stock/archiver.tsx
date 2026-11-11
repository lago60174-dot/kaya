"use client";

import { useActionState } from "react";
import { archiverProduitAction, type EtatStock } from "@/server/stock/actions";

export function ArchiverProduit({ produitId }: { produitId: string }) {
  const [etat, action] = useActionState<EtatStock, FormData>(
    archiverProduitAction,
    {},
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            "Archiver ce produit ? Il ne sera plus proposé à la vente. L'historique est conservé.",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="produitId" value={produitId} />
      <button
        type="submit"
        className="border-danger text-danger min-h-11 rounded-lg border px-3 text-sm font-medium"
      >
        Archiver ce produit
      </button>
      {etat.erreur && (
        <p role="alert" className="text-danger mt-1 text-sm">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
