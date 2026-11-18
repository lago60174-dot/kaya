"use client";

import { Store } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import type { BoutiqueAccessible } from "@/lib/boutiques/active";
import { choisirBoutiqueAction } from "@/server/boutique/selection";

/** Choix de la boutique dans laquelle on travaille. Affiché seulement quand il y a vraiment un choix. */
export function SelecteurBoutique({
  boutiques,
  activeId,
}: {
  boutiques: BoutiqueAccessible[];
  activeId: string | undefined;
}) {
  const chemin = usePathname();
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Store aria-hidden="true" size={20} className="text-brand-strong shrink-0" />
      <label htmlFor="boutique-active" className="sr-only">
        Boutique dans laquelle vous travaillez
      </label>
      <select
        id="boutique-active"
        value={activeId}
        disabled={enCours}
        onChange={(e) =>
          demarrer(() => choisirBoutiqueAction(e.target.value, chemin))
        }
        className="border-border min-h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-base font-semibold disabled:opacity-60"
      >
        {boutiques.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nom}
            {b.enEcriture ? "" : " (lecture seule)"}
          </option>
        ))}
      </select>
    </div>
  );
}
