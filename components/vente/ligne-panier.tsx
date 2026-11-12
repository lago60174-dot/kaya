"use client";

import { useState } from "react";
import { formatFcfa, formatQuantite } from "@/lib/format";
import { lireQuantite } from "@/lib/stock/quantites";
import {
  totalLigne,
  uniteDeLigne,
  type LignePanier,
} from "@/lib/ventes/panier";

const rond =
  "grid size-11 place-items-center rounded-lg border border-border text-xl";

interface Props {
  ligne: LignePanier;
  onQuantite: (q: number) => void;
  onUnite: (uniteId: string) => void;
  onRetirer: () => void;
}

export function LigneDuPanier({
  ligne,
  onQuantite,
  onUnite,
  onRetirer,
}: Props) {
  // Pendant la saisie on garde le texte tel quel (ex. "2,"), sinon on affiche la quantité du panier.
  const [saisie, setSaisie] = useState<string | null>(null);
  const unite = uniteDeLigne(ligne);
  const invalide = saisie !== null && lireQuantite(saisie) === null;
  return (
    <li className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{ligne.produit.nom}</p>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Retirer ${ligne.produit.nom}`}
          className={rond}
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ligne.produit.unites.length > 1 ? (
          <select
            aria-label="Unité"
            value={ligne.uniteId}
            onChange={(e) => onUnite(e.target.value)}
            className="border-border min-h-11 rounded-lg border bg-white px-2"
          >
            {ligne.produit.unites.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nom}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted text-sm">{unite.nom}</span>
        )}
        <button
          type="button"
          aria-label="Moins"
          disabled={ligne.quantite <= 1}
          onClick={() =>
            onQuantite(
              Math.max(1, Math.round((ligne.quantite - 1) * 1000) / 1000),
            )
          }
          className={rond}
        >
          −
        </button>
        <input
          inputMode="decimal"
          aria-label="Quantité"
          aria-invalid={invalide || undefined}
          value={saisie ?? formatQuantite(ligne.quantite)}
          onChange={(e) => {
            setSaisie(e.target.value);
            const q = lireQuantite(e.target.value);
            if (q !== null) onQuantite(q);
          }}
          onBlur={() => setSaisie(null)}
          className={`w-20 rounded-lg border bg-white px-2 text-center text-lg ${invalide ? "border-danger" : "border-border"}`}
        />
        <button
          type="button"
          aria-label="Plus"
          onClick={() =>
            onQuantite(Math.round((ligne.quantite + 1) * 1000) / 1000)
          }
          className={rond}
        >
          +
        </button>
        <span className="ml-auto font-semibold">
          {formatFcfa(totalLigne(ligne))}
        </span>
      </div>
      <p className="text-muted text-xs">
        {formatFcfa(unite.prixVente)} / {unite.nom}
      </p>
    </li>
  );
}
