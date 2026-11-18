"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { DELAI_ACTUALISATION_MS, doitActualiser } from "@/lib/patron/direct";

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Douala",
});

/**
 * Actualise la page d'administration toutes les minutes, tant que l'onglet est visible et que l'appareil
 * est en ligne. Pas de temps réel ici : l'admin lit toutes les boutiques et la minute suffit.
 * Rattrapage immédiat au retour sur l'onglet et au retour de la connexion.
 */
export function ActualisationAuto() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [enCours, demarrerTransition] = useTransition();
  const dernierRef = useRef(0);
  const attendaitRef = useRef(false);

  useEffect(() => {
    if (enCours) attendaitRef.current = true;
    else if (attendaitRef.current) {
      attendaitRef.current = false;
      setMajLe(new Date());
    }
  }, [enCours]);

  useEffect(() => {
    let minuteur: ReturnType<typeof setInterval> | undefined;

    const actualiser = () => {
      dernierRef.current = Date.now();
      demarrerTransition(() => router.refresh());
    };
    const demarrer = () => {
      minuteur = setInterval(() => {
        if (
          doitActualiser({
            visible: !document.hidden,
            enLigne: navigator.onLine,
            dernierMs: dernierRef.current,
            maintenantMs: Date.now(),
          })
        )
          actualiser();
      }, DELAI_ACTUALISATION_MS);
    };
    const arreter = () => clearInterval(minuteur);

    const surVisibilite = () => {
      const v = !document.hidden;
      setVisible(v);
      if (v) {
        actualiser();
        demarrer();
      } else arreter();
    };
    const surReconnexion = () => {
      if (!document.hidden) actualiser();
    };

    dernierRef.current = Date.now(); // la page vient d'être rendue par le serveur
    if (!document.hidden) demarrer();
    else void Promise.resolve().then(() => setVisible(false));
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("online", surReconnexion);
    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("online", surReconnexion);
      arreter();
    };
  }, [router]);

  return (
    <p
      role="status"
      className="text-muted flex flex-wrap items-center gap-x-2 text-sm"
      data-mode={visible ? "minute" : "arret"}
    >
      <span
        aria-hidden
        className={`inline-block size-2.5 rounded-full ${visible ? "bg-success" : "bg-border"}`}
      />
      {visible ? "Actualisation chaque minute" : "En pause"}
      {majLe && <span>· mis à jour à {HEURE.format(majLe)}</span>}
      {enCours && <span aria-live="polite">· actualisation…</span>}
    </p>
  );
}
