"use client";

import { useEffect, useRef, useState } from "react";
import {
  imprimerRecu,
  type FormatImpression,
  type MethodeImpression,
  type RecuImprimable,
} from "@/lib/print";
import { environnementNavigateur } from "@/lib/print/navigateur";
import { estAndroid } from "@/lib/print/rawbt";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";
const CLE_ACCENTS = "kaya.impression.accents";

type Etat =
  | { type: "repos" }
  | { type: "envoi" }
  | { type: "ok"; methode: MethodeImpression }
  | { type: "echec"; message: string; format: FormatImpression };

const MESSAGES_OK: Record<MethodeImpression, string> = {
  rawbt:
    "Ticket envoyé à RawBT. Si rien ne sort, vérifiez que RawBT est installé, l'imprimante allumée et le Bluetooth activé.",
  navigateur: "La fenêtre d'impression est ouverte.",
  pdf: "Impression directe impossible : le PDF s'est ouvert, vous pouvez l'imprimer depuis là.",
};

function lireAccents(): boolean {
  try {
    return localStorage.getItem(CLE_ACCENTS) === "1";
  } catch {
    return false;
  }
}

interface Props {
  numero: string;
  /** Route serveur du ticket ESC/POS (protégée par le plan). */
  escposUrl: string;
  pdfUrl: string;
}

/**
 * Impression ticket 58 mm et facture A4. L'impression ne bloque jamais la vente (déjà enregistrée) :
 * en cas d'échec, un message clair et un bouton « Réessayer ».
 */
export function BoutonsImpression({ numero, escposUrl, pdfUrl }: Props) {
  const [etat, setEtat] = useState<Etat>({ type: "repos" });
  const [accents, setAccents] = useState(false);
  const cache = useRef(new Map<string, Promise<Uint8Array>>());

  useEffect(() => {
    // Lecture du réglage de l'appareil après l'affichage (jamais pendant le rendu serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccents(lireAccents());
  }, []);

  /** Ticket ESC/POS, téléchargé une fois par réglage. Un échec n'est pas gardé : « Réessayer » retélécharge. */
  function chargerEscPos(avecAccents: boolean): Promise<Uint8Array> {
    const cle = avecAccents ? "1" : "0";
    let p = cache.current.get(cle);
    if (!p) {
      p = fetch(`${escposUrl}?accents=${cle}`)
        .then((r) => {
          if (!r.ok) throw new Error("Ticket indisponible.");
          return r.arrayBuffer();
        })
        .then((b) => new Uint8Array(b));
      p.catch(() => cache.current.delete(cle));
      cache.current.set(cle, p);
    }
    return p;
  }

  useEffect(() => {
    // Sur Android on prépare le ticket d'avance : le lien RawBT part alors tout de suite au tap.
    if (estAndroid(navigator.userAgent)) chargerEscPos(accents).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accents, escposUrl]);

  async function lancer(format: FormatImpression) {
    setEtat({ type: "envoi" });
    const recu: RecuImprimable = {
      numero,
      escpos: () => chargerEscPos(accents),
      pdfUrl,
    };
    const r = await imprimerRecu(recu, format, environnementNavigateur());
    setEtat(
      r.ok
        ? { type: "ok", methode: r.methode }
        : { type: "echec", message: r.message, format },
    );
  }

  function changerAccents(valeur: boolean) {
    setAccents(valeur);
    try {
      localStorage.setItem(CLE_ACCENTS, valeur ? "1" : "0");
    } catch {
      // réglage non mémorisé : sans conséquence
    }
  }

  const enCours = etat.type === "envoi";
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={enCours}
        onClick={() => void lancer("ticket")}
        className={bouton}
      >
        Imprimer le ticket (58 mm)
      </button>
      <button
        type="button"
        disabled={enCours}
        onClick={() => void lancer("a4")}
        className={bouton}
      >
        Imprimer la facture (A4)
      </button>
      {etat.type === "ok" && (
        <p role="status" className="text-muted text-sm">
          {MESSAGES_OK[etat.methode]}
        </p>
      )}
      {etat.type === "echec" && (
        <div
          role="alert"
          className="bg-brand-soft flex flex-col gap-2 rounded-lg p-3"
        >
          <p className="text-danger text-sm font-semibold">{etat.message}</p>
          <button
            type="button"
            onClick={() => void lancer(etat.format)}
            className={`${bouton} bg-white`}
          >
            Réessayer
          </button>
        </div>
      )}
      <details className="text-sm">
        <summary className="text-muted min-h-11 cursor-pointer py-2">
          Réglages de mon imprimante
        </summary>
        <label className="flex items-start gap-2 py-1">
          <input
            type="checkbox"
            checked={accents}
            onChange={(e) => changerAccents(e.target.checked)}
            className="mt-1 size-5"
          />
          <span>
            Mon imprimante affiche les accents (é, è, ç).
            <span className="text-muted block">
              À cocher seulement si les accents sortent bien. Sinon, le ticket
              s&apos;imprime sans accents, lisible sur toutes les imprimantes.
            </span>
          </span>
        </label>
      </details>
    </div>
  );
}
