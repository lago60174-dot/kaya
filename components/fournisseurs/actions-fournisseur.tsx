"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatFcfa } from "@/lib/format";
import { lireMontant } from "@/lib/stock/quantites";
import { MODES_PAIEMENT, type ModePaiement } from "@/lib/ventes/paiements";
import { annulerCommandeAction, payerDetteAction } from "@/server/fournisseurs/actions";

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

/** Paiement (partiel ou total) d'une dette fournisseur. */
export function PaiementDette({ detteId, solde }: { detteId: string; solde: number }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [montantTexte, setMontantTexte] = useState(String(solde));
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = useRef(crypto.randomUUID());
  const montant = lireMontant(montantTexte);
  const peut = montant !== null && montant > 0 && montant <= solde && !enCours;

  if (!ouvert)
    return (
      <button type="button" onClick={() => setOuvert(true)} className="border-border min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold">
        Payer
      </button>
    );
  async function payer() {
    if (!peut || montant === null) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await payerDetteAction({ detteId, cle: cle.current, montant, mode });
      if (r.ok) {
        router.refresh();
        setOuvert(false);
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnCours(false);
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label="Montant payé"
          inputMode="numeric"
          value={montantTexte}
          onChange={(e) => setMontantTexte(e.target.value)}
          className={`${champ} w-32`}
        />
        <select aria-label="Mode de paiement" value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} className={champ}>
          {MODES_PAIEMENT.map((m) => (
            <option key={m.code} value={m.code}>{m.libelle}</option>
          ))}
        </select>
      </div>
      {montant !== null && montant > solde && <p role="alert" className="text-danger text-sm">Vous devez {formatFcfa(solde)} au maximum.</p>}
      {erreur && <p role="alert" className="text-danger text-sm">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOuvert(false)} className={`${champ} font-semibold`}>Annuler</button>
        <button type="button" onClick={payer} disabled={!peut} className="bg-brand-strong min-h-11 rounded-lg px-4 font-semibold text-white disabled:opacity-50">
          {enCours ? "Enregistrement…" : "Valider"}
        </button>
      </div>
    </div>
  );
}

/** Annulation d'une commande pas encore reçue. Motif obligatoire. */
export function AnnulerCommande({ commandeId }: { commandeId: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!ouvert)
    return (
      <button type="button" onClick={() => setOuvert(true)} className="text-danger min-h-11 max-w-md text-sm font-semibold">
        Annuler cette commande
      </button>
    );
  async function annuler() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await annulerCommandeAction(commandeId, motif);
      if (r.ok) {
        router.refresh();
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setEnCours(false);
  }
  return (
    <div className="border-border flex max-w-md flex-col gap-2 rounded-2xl border bg-white p-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Motif de l&apos;annulation
        <input value={motif} maxLength={200} onChange={(e) => setMotif(e.target.value)} className={champ} />
      </label>
      {erreur && <p role="alert" className="text-danger text-sm">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOuvert(false)} className={`${champ} flex-1 font-semibold`}>Revenir</button>
        <button type="button" onClick={annuler} disabled={enCours || motif.trim().length < 3} className="bg-danger min-h-11 flex-1 rounded-lg px-4 font-semibold text-white disabled:opacity-50">
          {enCours ? "Annulation…" : "Annuler la commande"}
        </button>
      </div>
    </div>
  );
}
