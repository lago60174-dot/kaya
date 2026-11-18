"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DELAI_ACTUALISATION_MS,
  DELAI_REGROUPEMENT_MS,
  doitActualiser,
  modeMiseAJour,
} from "@/lib/patron/direct";
import { supabaseNavigateur } from "@/lib/supabase/client";

const TABLES = ["ventes", "paiements", "depenses", "clotures_caisse"] as const;

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Douala",
});

/**
 * Tient le tableau de bord à jour :
 * - toutes les minutes, tant que l'onglet est visible et que l'appareil est en ligne ;
 * - instantanément grâce au temps réel Supabase (ventes, paiements, dépenses, clôtures) ;
 * - rien quand l'onglet est caché (économie de ressources), puis rattrapage immédiat au retour
 *   et dès que la connexion revient.
 */
export function MiseAJourDirecte({
  boutiqueId,
  organisationId,
}: {
  /** Suit une boutique… */
  boutiqueId?: string;
  /** …ou, pour la vue d'ensemble, toutes les boutiques de l'organisation. */
  organisationId?: string;
}) {
  const cible = boutiqueId ?? organisationId ?? "";
  const filtre = boutiqueId
    ? `boutique_id=eq.${boutiqueId}`
    : `organisation_id=eq.${organisationId}`;
  const router = useRouter();
  const supabase = useMemo(() => supabaseNavigateur(), []);
  const [connecte, setConnecte] = useState(false);
  const [visible, setVisible] = useState(true);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [enCours, demarrerTransition] = useTransition();
  const connecteRef = useRef(false);
  const dernierRef = useRef(0);
  const attendaitRef = useRef(false);

  // Heure de la dernière actualisation réussie : on la note quand la transition se termine.
  useEffect(() => {
    if (enCours) attendaitRef.current = true;
    else if (attendaitRef.current) {
      attendaitRef.current = false;
      setMajLe(new Date());
    }
  }, [enCours]);

  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let regroupement: ReturnType<typeof setTimeout> | undefined;
    let minuteur: ReturnType<typeof setInterval> | undefined;

    const actualiser = () => {
      dernierRef.current = Date.now();
      demarrerTransition(() => router.refresh());
    };

    // Plusieurs événements rapprochés (une vente = ventes + paiements) ne font qu'une actualisation.
    const rafraichir = () => {
      clearTimeout(regroupement);
      regroupement = setTimeout(actualiser, DELAI_REGROUPEMENT_MS);
    };

    const demarrer = () => {
      const c = supabase.channel(`patron-${cible}`);
      for (const table of TABLES)
        c.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: filtre,
          },
          rafraichir,
        );
      c.subscribe((statut) => {
        const ok = statut === "SUBSCRIBED";
        connecteRef.current = ok;
        setConnecte(ok);
      });
      canal = c;
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

    const arreter = () => {
      clearTimeout(regroupement);
      clearInterval(minuteur);
      if (canal) void supabase.removeChannel(canal);
      canal = null;
      connecteRef.current = false;
      setConnecte(false);
    };

    const surVisibilite = () => {
      const v = !document.hidden;
      setVisible(v);
      if (v) {
        actualiser(); // rattrape ce qui s'est passé pendant l'absence
        demarrer();
      } else arreter();
    };

    // La connexion revient : on rattrape tout de suite sans attendre la minute suivante.
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
  }, [cible, filtre, router, supabase]);

  const mode = modeMiseAJour({ visible, canalConnecte: connecte });
  const texte =
    mode === "direct"
      ? "En direct · actualisé chaque minute"
      : mode === "minute"
        ? "Actualisation chaque minute"
        : "En pause";
  return (
    <p
      role="status"
      className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0 text-sm"
      data-mode={mode}
    >
      <span
        aria-hidden
        className={`inline-block size-2.5 rounded-full ${mode === "direct" ? "bg-success" : "bg-border"}`}
      />
      {texte}
      {majLe && <span>· mis à jour à {HEURE.format(majLe)}</span>}
      {enCours && <span aria-live="polite">· actualisation…</span>}
    </p>
  );
}
