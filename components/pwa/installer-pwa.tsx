"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLE = "kaya-pwa-masque";
const JOURS_MASQUE = 14;

function lireMasque(): boolean {
  try {
    const t = Number(localStorage.getItem(CLE));
    return t > 0 && Date.now() - t < JOURS_MASQUE * 86_400_000;
  } catch {
    return false;
  }
}

function dejaInstallee(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Invite à installer Kaya sur l'écran d'accueil : bouton natif sur Android/Chrome, consigne sur iPhone. */
export function InstallerPwa() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(
    null,
  );
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (dejaInstallee() || lireMasque()) return;
    const estIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent);
    // Les écrans se montent après le premier rendu : on évite un déphasage d'hydratation.
    const minuterie = window.setTimeout(() => {
      if (estIos) {
        setIos(true);
        setVisible(true);
      }
    }, 0);
    const surInvite = (e: Event) => {
      e.preventDefault();
      setEvenement(e as EvenementInstallation);
      setVisible(true);
    };
    const surInstallee = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", surInvite);
    window.addEventListener("appinstalled", surInstallee);
    return () => {
      window.clearTimeout(minuterie);
      window.removeEventListener("beforeinstallprompt", surInvite);
      window.removeEventListener("appinstalled", surInstallee);
    };
  }, []);

  function masquer() {
    setVisible(false);
    try {
      localStorage.setItem(CLE, String(Date.now()));
    } catch {
      /* stockage indisponible : l'invite reviendra à la prochaine visite */
    }
  }

  async function installer() {
    if (!evenement) return;
    await evenement.prompt();
    const choix = await evenement.userChoice;
    setEvenement(null);
    if (choix.outcome === "accepted") setVisible(false);
    else masquer();
  }

  if (!visible || (!evenement && !ios)) return null;

  return (
    <div
      role="dialog"
      aria-label="Installer Kaya"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-orange-200 bg-white p-3 shadow-lg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">Installer Kaya</p>
        <p className="text-neutral-600">
          {ios
            ? "Touchez Partager puis « Sur l'écran d'accueil »."
            : "Ouvrez Kaya comme une application, plus vite."}
        </p>
      </div>
      {!ios && (
        <button
          type="button"
          onClick={installer}
          className="bg-brand-strong flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white"
        >
          <Download className="size-4" aria-hidden />
          Installer
        </button>
      )}
      <button
        type="button"
        onClick={masquer}
        aria-label="Fermer"
        className="flex size-11 items-center justify-center rounded-xl text-neutral-500"
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
