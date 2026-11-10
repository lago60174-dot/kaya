"use client";

import { useActionState } from "react";
import {
  basculerVendeurAction,
  reinitialiserVendeurAction,
  type EtatVendeur,
} from "@/server/vendeurs/actions";
import { IdentifiantsProvisoires } from "./identifiants";

const bouton =
  "min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-brand-soft";

export function ActionsVendeur({
  membreId,
  actif,
}: {
  membreId: string;
  actif: boolean;
}) {
  const [etatBascule, basculer] = useActionState<EtatVendeur, FormData>(
    basculerVendeurAction,
    {},
  );
  const [etatMdp, reinitialiser] = useActionState<EtatVendeur, FormData>(
    reinitialiserVendeurAction,
    {},
  );
  const erreur = etatBascule.erreur ?? etatMdp.erreur;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={basculer}>
          <input type="hidden" name="membreId" value={membreId} />
          <input type="hidden" name="actif" value={String(!actif)} />
          <button type="submit" className={bouton}>
            {actif ? "Désactiver" : "Réactiver"}
          </button>
        </form>
        <form action={reinitialiser}>
          <input type="hidden" name="membreId" value={membreId} />
          <button type="submit" className={bouton}>
            Réinitialiser le mot de passe
          </button>
        </form>
      </div>
      {erreur && (
        <p role="alert" className="text-danger text-sm">
          {erreur}
        </p>
      )}
      {etatMdp.identifiants && (
        <IdentifiantsProvisoires {...etatMdp.identifiants} />
      )}
    </div>
  );
}
