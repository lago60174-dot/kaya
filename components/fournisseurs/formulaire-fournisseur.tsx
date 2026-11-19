"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  archiverFournisseurAction,
  enregistrerFournisseurAction,
} from "@/server/fournisseurs/actions";

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

interface Props {
  initial?: { id: string; nom: string; telephone: string | null; adresse: string | null; notes: string | null };
}

/** Fiche fournisseur : création, modification, archivage (refusé tant qu'une dette ou une commande est en cours). */
export function FormulaireFournisseur({ initial }: Props) {
  const router = useRouter();
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const r = await enregistrerFournisseurAction({ id: initial?.id ?? null, nom, telephone, adresse, notes });
      if (!r.ok) setErreur(r.erreur);
      else if (initial) {
        setMessage("Fiche enregistrée.");
        router.refresh();
      } else router.push(`/fournisseurs/${r.id}`);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnCours(false);
  }

  async function archiver() {
    if (!initial || !window.confirm("Archiver ce fournisseur ? Il disparaîtra de la liste.")) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await archiverFournisseurAction(initial.id);
      if (r.ok) {
        router.push("/fournisseurs");
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnCours(false);
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nom du fournisseur
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} className={champ} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Téléphone / WhatsApp (facultatif)
        <input value={telephone} type="tel" inputMode="tel" onChange={(e) => setTelephone(e.target.value)} maxLength={30} className={champ} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Adresse (facultatif)
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} maxLength={200} className={champ} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes (facultatif)
        <textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} maxLength={300} className={`${champ} py-2`} />
      </label>
      {erreur && <p role="alert" className="text-danger text-sm">{erreur}</p>}
      {message && <p role="status" className="text-success text-sm font-semibold">{message}</p>}
      <button
        type="button"
        onClick={enregistrer}
        disabled={enCours || nom.trim().length < 2}
        className="bg-brand-strong min-h-12 rounded-lg px-4 font-bold text-white disabled:opacity-50"
      >
        {enCours ? "Enregistrement…" : initial ? "Enregistrer" : "Ajouter le fournisseur"}
      </button>
      {initial && (
        <button type="button" onClick={archiver} disabled={enCours} className="text-danger min-h-11 text-sm font-semibold">
          Archiver ce fournisseur
        </button>
      )}
    </div>
  );
}
