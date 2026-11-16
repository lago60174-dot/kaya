"use client";

import { Banknote, Check, RefreshCw, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { repartirFifo, type CreanceOuverte } from "@/lib/clients/credit";
import { formatFcfa } from "@/lib/format";
import { lireMontant } from "@/lib/stock/quantites";
import { MODES_PAIEMENT, type ModePaiement } from "@/lib/ventes/paiements";
import { enregistrerPaiementAction } from "@/server/clients/actions";

interface Props {
  clientId: string;
  creances: CreanceOuverte[];
  dette: number;
}

/** Paiement partiel ou total. Le paiement solde les plus anciennes dettes d'abord ; l'aperçu montre ce qui sera soldé. */
export function FormulairePaiement({ clientId, creances, dette }: Props) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Même montant et même mode = même clé : un double clic ou un nouvel essai après coupure ne paie jamais deux fois.
  const tentative = useRef<{ empreinte: string; cle: string } | null>(null);

  const montant = lireMontant(texte);
  const apercu = montant !== null ? repartirFifo(creances, montant) : null;

  async function valider() {
    if (montant === null || !apercu?.ok || enCours) return;
    setEnCours(true);
    setErreur(null);
    const empreinte = `${montant}|${mode}`;
    if (tentative.current?.empreinte !== empreinte)
      tentative.current = { empreinte, cle: crypto.randomUUID() };
    try {
      const r = await enregistrerPaiementAction({
        clientId,
        cle: tentative.current.cle,
        mode,
        montant,
      });
      if (r.ok) {
        router.push(`/clients/${clientId}/paiement/${r.numero}`);
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur(
        "Pas de connexion. Rien n'est perdu : réessayez dans un instant.",
      );
    }
    setEnCours(false);
  }

  return (
    <section
      id="paiement"
      aria-label="Enregistrer un remboursement"
      className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <RefreshCw aria-hidden="true" size={22} className="text-blue-600" />
        Enregistrer un remboursement
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="montant-paiement" className="text-sm font-medium">
          Montant payé (FCFA)
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="montant-paiement"
            inputMode="numeric"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="0"
            className="border-border min-h-12 w-full max-w-xs rounded-xl border bg-white px-3 text-lg"
          />
          <button
            type="button"
            onClick={() => setTexte(String(dette))}
            className="border-border min-h-11 rounded-lg border px-3 text-sm font-medium"
          >
            Tout payer ({formatFcfa(dette)})
          </button>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Mode de paiement</legend>
        <div className="flex gap-2">
          {MODES_PAIEMENT.map((m) => {
            const actif = mode === m.code;
            const fond = m.code === "mtn_momo" ? "#ffcc00" : m.code === "orange_money" ? "#ff7900" : "#fff0e2";
            return (
              <button
                key={m.code}
                type="button"
                aria-pressed={actif}
                onClick={() => setMode(m.code)}
                className={`flex min-h-16 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-bold ${actif ? "border-orange-500 bg-orange-50" : "border-border bg-white"}`}
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-lg"
                  style={{ background: fond, color: m.code === "orange_money" ? "#fff" : "#7a3b00" }}
                >
                  {m.code === "especes" ? <Banknote size={20} /> : <Smartphone size={20} />}
                </span>
                {m.libelle}
              </button>
            );
          })}
        </div>
      </fieldset>

      {montant !== null && apercu?.ok && (
        <ul
          aria-label="Aperçu"
          className="bg-brand-soft flex flex-col gap-1 rounded-lg p-2 text-sm"
        >
          {apercu.parts.map((p) => (
            <li key={p.creanceId}>
              {p.numeroRecu} : {formatFcfa(p.montant)}{" "}
              {p.soldeApres === 0
                ? "(soldé)"
                : `(il restera ${formatFcfa(p.soldeApres)})`}
            </li>
          ))}
          <li className="font-semibold">
            {apercu.detteApres === 0
              ? "Le client ne devra plus rien."
              : `Il restera ${formatFcfa(apercu.detteApres)} à payer.`}
          </li>
        </ul>
      )}
      {montant !== null && apercu && !apercu.ok && (
        <p className="text-danger text-sm">{apercu.erreur}</p>
      )}
      {texte.trim() !== "" && montant === null && (
        <p className="text-danger text-sm">
          Entrez un montant en FCFA, sans décimales.
        </p>
      )}
      {erreur && (
        <p role="alert" className="text-danger text-sm">
          {erreur}
        </p>
      )}
      <button
        type="button"
        onClick={valider}
        disabled={enCours || !apercu?.ok}
        className="bg-brand-strong flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold text-white disabled:opacity-50"
      >
        <Check aria-hidden="true" size={22} />
        {enCours ? "Enregistrement…" : "Enregistrer le paiement"}
      </button>
    </section>
  );
}
