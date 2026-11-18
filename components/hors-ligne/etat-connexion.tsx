"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatFcfa } from "@/lib/format";
import {
  listerEnAttente,
  mettreAJourVente,
  retirerVente,
  type VenteEnAttente,
} from "@/lib/hors-ligne/stockage";
import { envoyerOperation, synchroniser } from "@/lib/hors-ligne/synchro";

/** État du réseau et file d'attente des ventes faites sans connexion, avec envoi automatique au retour du réseau. */
export function EtatConnexion({ retourVente = false }: { retourVente?: boolean }) {
  const router = useRouter();
  const [enLigne, setEnLigne] = useState(true);
  const [file, setFile] = useState<VenteEnAttente[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [recus, setRecus] = useState<string[]>([]);
  const occupe = useRef(false);

  const rafraichir = useCallback(async () => {
    try {
      setFile(await listerEnAttente());
    } catch {
      /* mémoire de l'appareil indisponible : rien à afficher */
    }
  }, []);

  const envoyer = useCallback(async () => {
    if (occupe.current || !navigator.onLine) return;
    occupe.current = true;
    try {
      const r = await synchroniser(envoyerOperation);
      if (r.envoyees > 0) {
        setInfo(`${r.envoyees} opération${r.envoyees > 1 ? "s" : ""} envoyée${r.envoyees > 1 ? "s" : ""} (ventes, dépenses).`);
        setRecus(r.recus.slice(0, 3));
        router.refresh();
      }
    } finally {
      occupe.current = false;
      await rafraichir();
    }
  }, [rafraichir, router]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setEnLigne(navigator.onLine);
      return rafraichir();
    });
    void envoyer();
    const retour = async () => {
      setEnLigne(true);
      await envoyer();
      if (retourVente) window.location.assign("/vente");
    };
    const coupure = () => setEnLigne(false);
    const visible = () => document.visibilityState === "visible" && void envoyer();
    window.addEventListener("online", retour);
    window.addEventListener("offline", coupure);
    window.addEventListener("kaya:file", rafraichir);
    document.addEventListener("visibilitychange", visible);
    const duWorker = (e: MessageEvent) => e.data?.type === "FILE_CHANGEE" && void rafraichir();
    navigator.serviceWorker?.addEventListener("message", duWorker);
    const minuteur = setInterval(() => void envoyer(), 30_000);
    return () => {
      window.removeEventListener("online", retour);
      window.removeEventListener("offline", coupure);
      window.removeEventListener("kaya:file", rafraichir);
      document.removeEventListener("visibilitychange", visible);
      navigator.serviceWorker?.removeEventListener("message", duWorker);
      clearInterval(minuteur);
    };
  }, [envoyer, rafraichir, retourVente]);

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => {
      setInfo(null);
      setRecus([]);
    }, 12000);
    return () => clearTimeout(t);
  }, [info]);

  const attente = file.filter((v) => v.statut === "attente");
  const refusees = file.filter((v) => v.statut === "refusee");
  if (enLigne && !info && file.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {!enLigne && (
        <p role="status" className="rounded-xl bg-amber-100 p-3 text-sm font-semibold text-amber-900">
          Pas de connexion. Continuez à vendre : vos ventes sont gardées sur cet appareil et envoyées toutes seules dès que le réseau revient.
          {attente.length > 0 && ` ${attente.length} opération${attente.length > 1 ? "s" : ""} en attente.`}
        </p>
      )}
      {enLigne && attente.length > 0 && (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-orange-100 p-3 text-sm font-semibold text-orange-900">
          {attente.length} opération{attente.length > 1 ? "s" : ""} en cours d&apos;envoi…
          <button type="button" onClick={() => void envoyer()} className="min-h-11 rounded-full bg-white px-4 font-bold">
            Envoyer maintenant
          </button>
        </p>
      )}
      {info && (
        <p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm font-semibold text-emerald-900">
          {info}
          {recus.map((id, i) => (
            <Link key={id} href={`/vente/recu/${id}`} className="ml-2 font-bold underline">
              Voir le reçu{recus.length > 1 ? ` ${i + 1}` : ""}
            </Link>
          ))}
        </p>
      )}
      {refusees.map((v) => (
        <div key={v.cle} role="alert" className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p>
            <b>{v.type === "depense" ? "Dépense refusée" : "Vente refusée"}</b> ({formatFcfa(v.total)}, {new Date(v.creeLe).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}) : {v.erreur}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-white px-4 font-bold"
              onClick={async () => {
                await mettreAJourVente({ ...v, statut: "attente", erreur: undefined });
                void envoyer();
              }}
            >
              Réessayer
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full bg-white px-4 font-bold text-red-700"
              onClick={async () => {
                if (confirm("Supprimer définitivement cette opération de cet appareil ? Elle ne sera jamais enregistrée.")) await retirerVente(v.cle);
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
