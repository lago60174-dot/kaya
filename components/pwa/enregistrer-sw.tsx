"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production seulement : en développement il gênerait le rechargement à chaud). */
export function EnregistrerSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Prépare l'écran de vente hors ligne (page + fichiers) tant que le réseau est là.
        if (navigator.onLine) reg.active?.postMessage({ type: "PRECHARGER" });
      })
      .catch(() => {
        /* Sans service worker, l'application reste un site normal. */
      });
  }, []);
  return null;
}
