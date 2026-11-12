"use client";

import { formatFcfa } from "@/lib/format";
import { lireMontant } from "@/lib/stock/quantites";
import {
  MODES_PAIEMENT,
  type LignePaiement,
  type ModePaiement,
} from "@/lib/ventes/paiements";

const select = "min-h-11 rounded-lg border border-border bg-white px-2";
const bouton =
  "min-h-11 rounded-lg border border-border px-3 text-sm font-medium";

interface Props {
  lignes: LignePaiement[];
  onChange: (l: LignePaiement[]) => void;
  credit: boolean;
  onCredit: (c: boolean) => void;
  total: number;
  peutForcer: boolean;
  forcer: boolean;
  onForcer: (f: boolean) => void;
}

/** Paiement simple ou mixte. Sans crédit, le dernier mode prend le reste ; avec crédit, ce qui n'est pas payé est dû par le client. */
export function PaiementsVente({
  lignes,
  onChange,
  credit,
  onCredit,
  total,
  peutForcer,
  forcer,
  onForcer,
}: Props) {
  const maj = (i: number, patch: Partial<LignePaiement>) =>
    onChange(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const avant = credit ? lignes : lignes.slice(0, -1);
  const reste =
    total - avant.reduce((s, l) => s + (lireMontant(l.montant) ?? 0), 0);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-semibold">Paiement</legend>
      {lignes.map((l, i) => {
        const dernierSansCredit = !credit && i === lignes.length - 1;
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Mode de paiement"
              value={l.mode}
              onChange={(e) => maj(i, { mode: e.target.value as ModePaiement })}
              className={select}
            >
              {MODES_PAIEMENT.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.libelle}
                </option>
              ))}
            </select>
            {dernierSansCredit ? (
              <span className="font-medium">
                {lignes.length > 1
                  ? `Reste : ${formatFcfa(Math.max(0, reste))}`
                  : formatFcfa(total)}
              </span>
            ) : (
              <input
                inputMode="numeric"
                aria-label="Montant payé (FCFA)"
                placeholder="Montant (FCFA)"
                value={l.montant}
                onChange={(e) => maj(i, { montant: e.target.value })}
                className="border-border min-h-11 w-36 rounded-lg border bg-white px-2"
              />
            )}
            {(lignes.length > 1 || credit) && (
              <button
                type="button"
                aria-label="Retirer ce mode de paiement"
                onClick={() => onChange(lignes.filter((_, j) => j !== i))}
                className={bouton}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onChange([...lignes, { mode: "mtn_momo", montant: "" }])
          }
          className={bouton}
        >
          {credit ? "+ Acompte" : "+ Autre mode (paiement mixte)"}
        </button>
      </div>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={credit}
          className="size-5"
          onChange={(e) => {
            onCredit(e.target.checked);
            onChange(
              e.target.checked ? [] : [{ mode: "especes", montant: "" }],
            );
          }}
        />
        Le client paie plus tard (crédit)
      </label>
      {credit && peutForcer && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={forcer}
            onChange={(e) => onForcer(e.target.checked)}
            className="size-5"
          />
          Dépasser le plafond de crédit du client (propriétaire)
        </label>
      )}
    </fieldset>
  );
}
