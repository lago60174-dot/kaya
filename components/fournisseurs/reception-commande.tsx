"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { resteARecevoir, totalLigneCommande, type LigneCommandeDetail } from "@/lib/fournisseurs/fournisseurs";
import { formatFcfa, formatQuantite } from "@/lib/format";
import { lireMontant, lireQuantite } from "@/lib/stock/quantites";
import { MODES_PAIEMENT, type ModePaiement } from "@/lib/ventes/paiements";
import { receptionnerCommandeAction } from "@/server/fournisseurs/actions";

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

/** Réception : on indique ce qui est arrivé (par défaut tout le reste). Stock, prix d'achat et dette suivent. */
export function ReceptionCommande({ commandeId, lignes }: { commandeId: string; lignes: LigneCommandeDetail[] }) {
  const router = useRouter();
  const attendues = lignes.filter((l) => resteARecevoir(l) > 0);
  const [ouvert, setOuvert] = useState(false);
  const [saisies, setSaisies] = useState<Record<string, string>>(
    Object.fromEntries(attendues.map((l) => [l.id, formatQuantite(resteARecevoir(l)).replace(/\s/g, "")])),
  );
  const [payeTexte, setPayeTexte] = useState("");
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const cle = useRef(crypto.randomUUID());

  const recues = attendues.map((l) => ({ l, q: lireQuantite(saisies[l.id] ?? "") ?? Number.NaN }));
  const aRecevoir = recues.filter((x) => x.q > 0);
  const depasse = recues.some((x) => x.q > resteARecevoir(x.l));
  const invalide = recues.some((x) => Number.isNaN(x.q) || x.q < 0);
  const valeur = aRecevoir.reduce((t, x) => t + totalLigneCommande(x.q, x.l.prixAchat), 0);
  const paye = payeTexte.trim() === "" ? 0 : lireMontant(payeTexte);
  const payeInvalide = paye === null || paye > valeur;
  const peut = aRecevoir.length > 0 && !invalide && !depasse && !payeInvalide && !enCours;

  if (attendues.length === 0) return null;
  if (!ouvert)
    return (
      <button type="button" onClick={() => setOuvert(true)} className="bg-brand-strong min-h-12 max-w-md rounded-lg px-4 font-bold text-white">
        Recevoir la marchandise
      </button>
    );

  async function valider() {
    if (!peut) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await receptionnerCommandeAction({
        commandeId,
        cle: cle.current,
        lignes: aRecevoir.map((x) => ({ commandeLigneId: x.l.id, quantite: x.q })),
        paye: paye ?? 0,
        mode,
      });
      if (r.ok) {
        setInfo(
          `Réception enregistrée : ${formatFcfa(r.montant)}.` +
            (r.prixModifies > 0 ? ` ${r.prixModifies} prix d'achat mis à jour.` : ""),
        );
        setOuvert(false);
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
    <div className="border-border flex max-w-md flex-col gap-3 rounded-2xl border bg-white p-3">
      {info && <p role="status" className="text-success text-sm font-semibold">{info}</p>}
      <p className="font-semibold">Quantités reçues</p>
      <ul className="flex flex-col gap-2">
        {attendues.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm">
              <b className="block truncate">{l.nom}</b>
              reste {formatQuantite(resteARecevoir(l))} {l.unite}
            </span>
            <input
              aria-label={`Quantité reçue de ${l.nom}`}
              inputMode="decimal"
              value={saisies[l.id] ?? ""}
              onChange={(e) => setSaisies((s) => ({ ...s, [l.id]: e.target.value }))}
              className={`${champ} w-24 text-right`}
            />
          </li>
        ))}
      </ul>
      <p className="font-semibold">Valeur reçue : {formatFcfa(valeur)}</p>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
          Payé maintenant (FCFA)
          <input inputMode="numeric" value={payeTexte} placeholder="0" onChange={(e) => setPayeTexte(e.target.value)} className={champ} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
          Mode
          <select value={mode} onChange={(e) => setMode(e.target.value as ModePaiement)} className={champ}>
            {MODES_PAIEMENT.map((m) => (
              <option key={m.code} value={m.code}>{m.libelle}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-muted text-sm">
        Le reste ({formatFcfa(Math.max(0, valeur - (paye ?? 0)))}) devient une dette envers le fournisseur.
      </p>
      {(erreur || depasse || payeInvalide) && (
        <p role="alert" className="text-danger text-sm">
          {erreur ?? (depasse ? "Vous recevez plus que la quantité attendue." : "Le montant payé dépasse la valeur reçue.")}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOuvert(false)} className={`${champ} flex-1 font-semibold`}>Annuler</button>
        <button type="button" onClick={valider} disabled={!peut} className="bg-brand-strong min-h-11 flex-1 rounded-lg px-4 font-semibold text-white disabled:opacity-50">
          {enCours ? "Enregistrement…" : "Valider la réception"}
        </button>
      </div>
    </div>
  );
}
