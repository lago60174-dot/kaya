"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const champ =
  "min-h-11 rounded-lg border border-border bg-white px-3 text-base";

/** Recherche (délai de 300 ms) et filtres : tout passe par l'adresse de la page. */
export function FiltresRecus({
  vendeurs,
}: {
  vendeurs: { id: string; nom: string }[];
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
    suivant.delete("apres_date");
    suivant.delete("apres_id");
    router.replace(`/recus${suivant.size ? `?${suivant}` : ""}`);
  }

  useEffect(() => () => clearTimeout(minuteur.current), []);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        aria-label="Chercher un reçu"
        placeholder="Numéro, client, téléphone ou montant"
        className={champ}
        onChange={(e) => {
          setQ(e.target.value);
          clearTimeout(minuteur.current);
          minuteur.current = setTimeout(
            () => appliquer({ q: e.target.value.trim() || null }),
            300,
          );
        }}
      />
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Statut"
          className={champ}
          value={params.get("statut") ?? ""}
          onChange={(e) => appliquer({ statut: e.target.value || null })}
        >
          <option value="">Tous les statuts</option>
          <option value="valide">Valides</option>
          <option value="annulee">Annulés</option>
        </select>
        {vendeurs.length > 0 && (
          <select
            aria-label="Vendeur"
            className={champ}
            value={params.get("vendeur") ?? ""}
            onChange={(e) => appliquer({ vendeur: e.target.value || null })}
          >
            <option value="">Tous les vendeurs</option>
            {vendeurs.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm">
          Du
          <input
            type="date"
            className={champ}
            value={params.get("du") ?? ""}
            onChange={(e) => appliquer({ du: e.target.value || null })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          au
          <input
            type="date"
            className={champ}
            value={params.get("au") ?? ""}
            onChange={(e) => appliquer({ au: e.target.value || null })}
          />
        </label>
      </div>
    </div>
  );
}
