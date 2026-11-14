"use client";

import { useEffect } from "react";

/** Enregistre le service worker (production seulement : en développement il gênerait le rechargement à chaud). */
export function EnregistrerSw() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        /* Sans service worker, l'application reste un site normal. */
      });
  }, []);
  return null;
}
