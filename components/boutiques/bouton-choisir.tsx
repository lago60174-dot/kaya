"use client";

import { useTransition } from "react";
import { choisirBoutiqueAction } from "@/server/boutique/selection";

export function BoutonChoisirBoutique({ boutiqueId }: { boutiqueId: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(() => choisirBoutiqueAction(boutiqueId, "/boutiques"))}
      className="border-border min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-60"
    >
      {enCours ? "Un instant…" : "Travailler dans cette boutique"}
    </button>
  );
}
