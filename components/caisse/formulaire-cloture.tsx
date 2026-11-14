"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { calculerEcart, jugerEcart } from "@/lib/caisse/caisse";
import { formatFcfa } from "@/lib/format";
import { lireMontant } from "@/lib/stock/quantites";
import { cloturerCaisseAction } from "@/server/caisse/actions";

interface Props {
  date: string;
  especesAttendues: number;
  tolerance: number;
}

/** Clôture : on saisit les espèces comptées, l'écart s'affiche avant de valider, puis une confirmation est demandée. */
export function FormulaireCloture({
  date,
  especesAttendues,
  tolerance,
}: Props) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const compte = lireMontant(texte);
  const ecart =
    compte !== null ? calculerEcart(especesAttendues, compte) : null;
  const jugement =
    ecart !== null ? jugerEcart(ecart, tolerance, formatFcfa) : null;

  async function cloturer() {
    if (compte === null || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await cloturerCaisseAction({ date, especesComptees: compte });
      if (r.ok) {
        router.refresh();
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur(
        "Pas de connexion. Rien n'est perdu : réessayez dans un instant.",
      );
    }
    setConfirmer(false);
    setEnCours(false);
  }

  const couleur = {
    juste: "bg-brand-soft",
    tolere: "bg-brand-soft",
    alerte: "border-danger border",
  } as const;

  return (
    <section
      aria-label="Clôturer la caisse"
      className="border-border flex flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="text-lg font-semibold">Clôturer la caisse</h2>
      <p className="text-sm">
        Comptez les espèces dans le tiroir, puis entrez le total.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="especes-comptees" className="text-sm font-medium">
          Espèces comptées (FCFA)
        </label>
        <input
          id="especes-comptees"
          inputMode="numeric"
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setConfirmer(false);
          }}
          placeholder="0"
          className="border-border min-h-11 w-44 rounded-lg border bg-white px-3 text-lg"
        />
        {texte.trim() !== "" && compte === null && (
          <p className="text-danger text-sm">
            Entrez un montant en FCFA, sans décimales.
          </p>
        )}
      </div>
      {jugement && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm font-medium ${couleur[jugement.niveau]}`}
        >
          {jugement.message}
        </p>
      )}
      {erreur && (
        <p role="alert" className="text-danger text-sm">
          {erreur}
        </p>
      )}
      {!confirmer ? (
        <button
          type="button"
          onClick={() => setConfirmer(true)}
          disabled={compte === null}
          className="bg-brand-strong min-h-12 rounded-lg px-4 text-lg font-bold text-white disabled:opacity-50"
        >
          Clôturer la caisse
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Confirmer la clôture avec {formatFcfa(compte ?? 0)} comptés ? Elle
            ne pourra plus être modifiée.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cloturer}
              disabled={enCours}
              className="bg-brand-strong min-h-12 flex-1 rounded-lg px-4 font-bold text-white disabled:opacity-50"
            >
              {enCours ? "Clôture…" : "Oui, clôturer"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmer(false)}
              disabled={enCours}
              className="border-border min-h-12 rounded-lg border px-4 font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
