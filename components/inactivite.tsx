"use client";

import { useEffect } from "react";
import { DELAI_INACTIVITE_MS } from "@/lib/auth/inactivite";
import { deconnecter } from "@/server/auth/actions";

/** Déconnecte l'utilisateur après une longue inactivité. */
export function InactiviteDeconnexion() {
  useEffect(() => {
    const evenements = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const;
    let minuteur = setTimeout(() => void deconnecter(), DELAI_INACTIVITE_MS);
    const relancer = () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => void deconnecter(), DELAI_INACTIVITE_MS);
    };
    evenements.forEach((e) =>
      window.addEventListener(e, relancer, { passive: true }),
    );
    return () => {
      clearTimeout(minuteur);
      evenements.forEach((e) => window.removeEventListener(e, relancer));
    };
  }, []);
  return null;
}
