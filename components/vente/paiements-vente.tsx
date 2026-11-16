"use client";

import { Banknote, Smartphone } from "lucide-react";
import { formatFcfa } from "@/lib/format";
import { lireMontant } from "@/lib/stock/quantites";
import {
  MODES_PAIEMENT,
  type LignePaiement,
} from "@/lib/ventes/paiements";

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
            <div role="group" aria-label="Mode de paiement" className="flex gap-2">
              {MODES_PAIEMENT.map((m) => {
                const actif = l.mode === m.code;
                const fond = m.code === "mtn_momo" ? "#ffcc00" : m.code === "orange_money" ? "#ff7900" : "#fff0e2";
                return (
                  <button
                    key={m.code}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => maj(i, { mode: m.code })}
                    className={`flex min-h-14 w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold ${actif ? "border-orange-500 bg-orange-50" : "border-border bg-white"}`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-7 place-items-center rounded-lg"
                      style={{ background: fond, color: m.code === "orange_money" ? "#fff" : "#7a3b00" }}
                    >
                      {m.code === "especes" ? <Banknote size={18} /> : <Smartphone size={18} />}
                    </span>
                    {m.code === "mtn_momo" ? "MTN MoMo" : m.code === "orange_money" ? "Orange Money" : "Espèces"}
                  </button>
                );
              })}
            </div>
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
