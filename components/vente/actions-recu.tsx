"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

interface Props {
  /** Lien wa.me (numéro du client si connu) avec le résumé et le lien public du reçu. */
  lienWhatsApp: string;
  /** Résumé du reçu, utilisé avec le fichier PDF quand le téléphone sait partager un fichier. */
  message: string;
  pdfUrl: string;
  nomFichier: string;
  peutImprimer: boolean;
}

/**
 * Partage : sur Android, le PDF est envoyé comme fichier via le menu de partage (WhatsApp du vendeur) ;
 * sinon, un lien wa.me avec le résumé et le lien du reçu. Le PDF est préchargé pour que le geste reste immédiat.
 * Rien ici ne bloque la vente : elle est déjà enregistrée.
 */
export function ActionsRecu({
  lienWhatsApp,
  message,
  pdfUrl,
  nomFichier,
  peutImprimer,
}: Props) {
  const fichier = useRef<File | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.canShare) return;
    let annule = false;
    fetch(pdfUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!annule && blob)
          fichier.current = new File([blob], nomFichier, {
            type: "application/pdf",
          });
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [pdfUrl, nomFichier]);

  async function partager(e: React.MouseEvent<HTMLAnchorElement>) {
    const f = fichier.current;
    if (!f || !navigator.canShare?.({ files: [f] })) return; // le lien wa.me s'ouvre normalement
    e.preventDefault();
    try {
      await navigator.share({ files: [f], text: message });
    } catch (erreur) {
      if (erreur instanceof DOMException && erreur.name === "AbortError")
        return; // le vendeur a fermé le menu
      window.open(lienWhatsApp, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="recu-actions flex max-w-md flex-col gap-2">
      <a
        href={lienWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={partager}
        className={`${bouton} bg-success text-white`}
      >
        Partager sur WhatsApp
      </a>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={bouton}
      >
        Ouvrir le PDF
      </a>
      {peutImprimer && (
        <button type="button" onClick={() => window.print()} className={bouton}>
          Imprimer
        </button>
      )}
      <Link href="/vente" className={`${bouton} bg-brand-strong text-white`}>
        Nouvelle vente
      </Link>
    </div>
  );
}
