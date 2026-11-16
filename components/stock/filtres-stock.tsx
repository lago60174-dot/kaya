"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Option {
  id: string;
  nom: string;
}

const champ =
  "min-h-11 rounded-lg border border-border bg-white px-3 text-base";

/** Recherche avec délai (300 ms) et filtres : tout passe par l'adresse de la page, sans rechargement lourd. */
export function FiltresStock({
  categories,
  marques,
}: {
  categories: Option[];
  marques: Option[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);

  function appliquer(changements: Record<string, string | null>) {
    const suivant = new URLSearchParams(params.toString());
    for (const [cle, valeur] of Object.entries(changements)) {
      if (valeur) suivant.set(cle, valeur);
      else suivant.delete(cle);
    }
    suivant.delete("apres_nom");
    suivant.delete("apres_id");
    router.replace(`/stock${suivant.size ? `?${suivant}` : ""}`);
  }

  useEffect(() => () => clearTimeout(minuteur.current), []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search aria-hidden="true" size={20} className="text-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            clearTimeout(minuteur.current);
            minuteur.current = setTimeout(
              () => appliquer({ q: e.target.value.trim() || null }),
              300,
            );
          }}
          placeholder="Chercher un produit ou une marque"
          aria-label="Chercher un produit ou une marque"
          className="border-border min-h-12 w-full rounded-full border bg-white pr-4 pl-12 text-base"
        />
      </div>
      <div role="group" aria-label="Catégorie" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[{ id: "", nom: "Tous" }, ...categories].map((c) => {
          const actif = (params.get("categorie") ?? "") === c.id;
          return (
            <button
              key={c.id || "tous"}
              type="button"
              aria-pressed={actif}
              onClick={() => appliquer({ categorie: c.id || null })}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${actif ? "bg-orange-500 text-white" : "border-border border bg-white"}`}
            >
              {c.nom}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Marque"
          className={champ}
          value={params.get("marque") ?? ""}
          onChange={(e) => appliquer({ marque: e.target.value || null })}
        >
          <option value="">Toutes les marques</option>
          {marques.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={params.get("bas") === "1"}
            onChange={(e) => appliquer({ bas: e.target.checked ? "1" : null })}
            className="size-5"
          />
          Stock bas seulement
        </label>
      </div>
    </div>
  );
}
