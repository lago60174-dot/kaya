"use client";

import { useEffect, useState, useTransition } from "react";
import {
  enregistrerPushAction,
  retirerPushAction,
} from "@/server/notifications/actions";

type Etat =
  | "chargement"
  | "non_configure"
  | "non_supporte"
  | "iphone_installer"
  | "refuse"
  | "actif"
  | "inactif";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

function cleVersBytes(base64: string): Uint8Array<ArrayBuffer> {
  const rempli = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const brut = atob(rempli);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/**
 * Notifications push sur cet appareil. Android et PC : directement. iPhone : seulement quand Kaya est ajoutée
 * à l'écran d'accueil (règle d'Apple, iOS 16.4 ou plus récent) : on l'explique au lieu d'échouer en silence.
 */
export function ActiverPush({ clePublique }: { clePublique: string | null }) {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    let annule = false;
    (async () => {
      if (!clePublique) return annule || setEtat("non_configure");
      const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installee =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (iphone && !installee) return annule || setEtat("iphone_installer");
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        return annule || setEtat("non_supporte");
      if (Notification.permission === "denied")
        return annule || setEtat("refuse");
      const reg = await navigator.serviceWorker.ready;
      const abonnement = await reg.pushManager.getSubscription();
      if (!annule) setEtat(abonnement ? "actif" : "inactif");
    })().catch(() => !annule && setEtat("non_supporte"));
    return () => {
      annule = true;
    };
  }, [clePublique]);

  function activer() {
    setMessage(null);
    demarrer(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setEtat("refuse");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const abonnement =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: cleVersBytes(clePublique!),
          }));
        const r = await enregistrerPushAction(abonnement.toJSON());
        if (r.erreur) setMessage(r.erreur);
        else setEtat("actif");
      } catch {
        setMessage("Les notifications n'ont pas pu être activées. Réessayez.");
      }
    });
  }

  function desactiver() {
    setMessage(null);
    demarrer(async () => {
      const reg = await navigator.serviceWorker.ready;
      const abonnement = await reg.pushManager.getSubscription();
      if (abonnement) {
        await retirerPushAction(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setEtat("inactif");
    });
  }

  const texte: Partial<Record<Etat, string>> = {
    non_configure:
      "Les notifications sur téléphone ne sont pas encore configurées sur ce serveur.",
    non_supporte: "Ce navigateur ne sait pas afficher les notifications.",
    iphone_installer:
      "Sur iPhone, ajoutez d'abord Kaya à l'écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil »), ouvrez-la depuis l'icône, puis revenez ici pour activer les notifications.",
    refuse:
      "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages de votre navigateur, puis revenez ici.",
  };

  return (
    <div className="flex flex-col gap-2">
      {texte[etat] && <p className="text-muted text-sm">{texte[etat]}</p>}
      {etat === "inactif" && (
        <button type="button" onClick={activer} disabled={enCours} className={bouton}>
          {enCours ? "Activation…" : "Activer les notifications sur cet appareil"}
        </button>
      )}
      {etat === "actif" && (
        <>
          <p className="text-success text-sm font-semibold">
            Notifications activées sur cet appareil.
          </p>
          <button type="button" onClick={desactiver} disabled={enCours} className={bouton}>
            Désactiver sur cet appareil
          </button>
        </>
      )}
      {message && (
        <p role="alert" className="text-danger text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
