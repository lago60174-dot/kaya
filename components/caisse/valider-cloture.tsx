"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { validerClotureAction } from "@/server/caisse/actions";

/** Validation d'une clôture par le propriétaire. */
export function ValiderCloture({ clotureId }: { clotureId: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await validerClotureAction({ clotureId });
      if (r.ok) {
        router.refresh();
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnCours(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={valider}
        disabled={enCours}
        className="bg-brand-strong min-h-11 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {enCours ? "Validation…" : "Valider cette caisse"}
      </button>
      {erreur && (
        <p role="alert" className="text-danger text-sm">
          {erreur}
        </p>
      )}
    </div>
  );
}
