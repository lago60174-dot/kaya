"use client";

import { useActionState } from "react";
import {
  archiverClientAction,
  type EtatClient,
} from "@/server/clients/actions";

export function ArchiverClient({
  clientId,
  nom,
}: {
  clientId: string;
  nom: string;
}) {
  const [etat, action] = useActionState<EtatClient, FormData>(
    archiverClientAction,
    {},
  );
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Archiver ${nom} ? Il ne sera plus proposé, mais son historique est conservé.`,
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <button
        type="submit"
        className="border-danger text-danger min-h-11 rounded-lg border px-3 text-sm font-medium"
      >
        Archiver ce client
      </button>
      {etat.erreur && (
        <p role="alert" className="text-danger mt-1 text-sm">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
