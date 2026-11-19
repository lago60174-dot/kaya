"use client";

import { Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { creerBonLivraisonAction } from "@/server/devis/actions";

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

/** Bon de livraison d'une vente ou d'un devis accepté. Aucun prix, aucun mouvement de stock. */
export function FormulaireBon({
  source,
}: {
  source: { venteId: string } | { devisId: string };
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const envoi = useRef(false);

  async function creer() {
    if (envoi.current) return;
    envoi.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await creerBonLivraisonAction({ ...source, adresse, note });
      if (r.ok) {
        router.push(`/devis/livraisons/${r.bonId}`);
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    envoi.current = false;
    setEnCours(false);
  }

  if (!ouvert)
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="border-border flex min-h-11 max-w-md items-center justify-center gap-2 rounded-lg border px-4 text-base font-semibold"
      >
        <Truck aria-hidden="true" size={20} /> Bon de livraison
      </button>
    );
  return (
    <div className="border-border flex max-w-md flex-col gap-2 rounded-2xl border bg-white p-3">
      <label htmlFor="adresse-bon" className="text-sm font-medium">Adresse de livraison (facultatif)</label>
      <input
        id="adresse-bon"
        value={adresse}
        maxLength={200}
        onChange={(e) => setAdresse(e.target.value)}
        className={champ}
      />
      <label htmlFor="note-bon" className="text-sm font-medium">Note (facultatif)</label>
      <input
        id="note-bon"
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        className={champ}
      />
      {erreur && <p role="alert" className="text-danger text-sm">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOuvert(false)} className={`${champ} flex-1 font-semibold`}>
          Annuler
        </button>
        <button
          type="button"
          onClick={creer}
          disabled={enCours}
          className="bg-brand-strong min-h-11 flex-1 rounded-lg px-4 font-semibold text-white disabled:opacity-50"
        >
          {enCours ? "Création…" : "Créer le bon"}
        </button>
      </div>
    </div>
  );
}
