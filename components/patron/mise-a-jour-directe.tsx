"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DELAI_REGROUPEMENT_MS,
  DELAI_SECOURS_MS,
  modeMiseAJour,
} from "@/lib/patron/direct";
import { supabaseNavigateur } from "@/lib/supabase/client";

const TABLES = ["ventes", "paiements", "depenses", "clotures_caisse"] as const;

/**
 * Tient le tableau de bord à jour : temps réel Supabase tant que l'onglet est visible,
 * repli sur une actualisation toutes les 30 s si la connexion temps réel est coupée,
 * et rien du tout quand l'onglet est caché (économie de ressources).
 */
export function MiseAJourDirecte({ boutiqueId }: { boutiqueId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseNavigateur(), []);
  const [connecte, setConnecte] = useState(false);
  const [visible, setVisible] = useState(true);
  const connecteRef = useRef(false);

  useEffect(() => {
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let regroupement: ReturnType<typeof setTimeout> | undefined;
    let secours: ReturnType<typeof setInterval> | undefined;

    // Plusieurs événements rapprochés (une vente = ventes + paiements) ne font qu'une actualisation.
    const rafraichir = () => {
      clearTimeout(regroupement);
      regroupement = setTimeout(() => router.refresh(), DELAI_REGROUPEMENT_MS);
    };

    const demarrer = () => {
      const c = supabase.channel(`patron-${boutiqueId}`);
      for (const table of TABLES)
        c.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `boutique_id=eq.${boutiqueId}`,
          },
          rafraichir,
        );
      c.subscribe((statut) => {
        const ok = statut === "SUBSCRIBED";
        connecteRef.current = ok;
        setConnecte(ok);
      });
      canal = c;
      secours = setInterval(() => {
        if (!connecteRef.current) router.refresh();
      }, DELAI_SECOURS_MS);
    };

    const arreter = () => {
      clearTimeout(regroupement);
      clearInterval(secours);
      if (canal) void supabase.removeChannel(canal);
      canal = null;
      connecteRef.current = false;
      setConnecte(false);
    };

    const surVisibilite = () => {
      const v = !document.hidden;
      setVisible(v);
      if (v) {
        router.refresh(); // rattrape ce qui s'est passé pendant l'absence
        demarrer();
      } else arreter();
    };

    if (!document.hidden) demarrer();
    else void Promise.resolve().then(() => setVisible(false));
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      arreter();
    };
  }, [boutiqueId, router, supabase]);

  const mode = modeMiseAJour({ visible, canalConnecte: connecte });
  const texte =
    mode === "direct"
      ? "En direct"
      : mode === "secours"
        ? "Actualisation toutes les 30 secondes"
        : "En pause";
  return (
    <p
      role="status"
      className="text-muted flex items-center gap-2 text-sm"
      data-mode={mode}
    >
      <span
        aria-hidden
        className={`inline-block size-2.5 rounded-full ${mode === "direct" ? "bg-success" : "bg-border"}`}
      />
      {texte}
    </p>
  );
}
