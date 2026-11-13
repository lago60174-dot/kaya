"use client";

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
      aria-label="Encaisser un paiement"
      className="border-border flex max-w-md flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="text-lg font-semibold">Encaisser un paiement</h2>
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
            className="border-border min-h-11 w-40 rounded-lg border bg-white px-3 text-lg"
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
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-medium">Payé par</legend>
        {MODES_PAIEMENT.map((m) => (
          <label
            key={m.code}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${mode === m.code ? "border-brand-strong bg-brand-soft font-semibold" : "border-border"}`}
          >
            <input
              type="radio"
              name="mode"
              value={m.code}
              checked={mode === m.code}
              onChange={() => setMode(m.code)}
              className="size-4"
            />
            {m.libelle}
          </label>
        ))}
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
        className="bg-brand-strong min-h-12 rounded-lg px-4 text-lg font-bold text-white disabled:opacity-50"
      >
        {enCours ? "Enregistrement…" : "Enregistrer le paiement"}
      </button>
    </section>
  );
}
