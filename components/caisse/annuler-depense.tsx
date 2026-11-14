"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { annulerDepenseAction } from "@/server/caisse/actions";

/** Annulation d'une dépense saisie par erreur : propriétaire seulement, motif obligatoire. */
export function AnnulerDepense({ depenseId }: { depenseId: string }) {
  const router = useRouter();
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function annuler() {
    if (enCours || motif.trim() === "") return;
    if (
      !confirm(
        "Annuler cette dépense ? Elle ne sortira plus de la caisse, mais restera visible, barrée.",
      )
    )
      return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await annulerDepenseAction({ depenseId, motif });
      if (r.ok) router.refresh();
      else setErreur(r.erreur);
    } catch {
      setErreur(
        "Pas de connexion. Rien n'est perdu : réessayez dans un instant.",
      );
    }
    setEnCours(false);
  }

  return (
    <details className="text-sm">
      <summary className="text-danger flex min-h-11 cursor-pointer items-center underline">
        Annuler cette dépense
      </summary>
      <div className="flex flex-col gap-2 pb-2">
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          required
          maxLength={200}
          placeholder="Motif (obligatoire)"
          aria-label="Motif de l'annulation"
          className="border-border min-h-11 rounded-lg border bg-white px-3 text-base"
        />
        {erreur && (
          <p role="alert" className="text-danger">
            {erreur}
          </p>
        )}
        <button
          type="button"
          onClick={annuler}
          disabled={enCours || motif.trim() === ""}
          className="border-danger text-danger min-h-11 self-start rounded-lg border px-3 font-semibold disabled:opacity-60"
        >
          {enCours ? "Annulation…" : "Confirmer l'annulation"}
        </button>
      </div>
    </details>
  );
}
