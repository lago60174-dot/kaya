"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { BoutonsImpression } from "@/components/impression/boutons-impression";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

interface Props {
  /** Lien wa.me (numéro du client si connu) avec le résumé et le lien public du reçu. */
  lienWhatsApp: string;
  /** Résumé du reçu, utilisé avec le fichier PDF quand le téléphone sait partager un fichier. */
  message: string;
  pdfUrl: string;
  nomFichier: string;
  /** Numéro affiché dans les messages d'impression. */
  numero: string;
  /** Route du ticket ESC/POS. L'impression n'est proposée que si le plan l'autorise. */
  escposUrl: string;
  peutImprimer: boolean;
  /** Dernier bouton : « Nouvelle vente » ou « Retour au client ». */
  suite: { href: string; libelle: string };
}

/**
 * Partage : sur Android, le PDF est envoyé comme fichier via le menu de partage (WhatsApp du vendeur) ;
 * sinon, un lien wa.me avec le résumé et le lien du reçu. Le PDF est préchargé pour que le geste reste immédiat.
 * Impression (plans Pro et Business) : ticket 58 mm, facture A4, repli PDF (lib/print).
 * Rien ici ne bloque la vente : elle est déjà enregistrée.
 * Sert aux reçus de vente et aux reçus de paiement de crédit.
 */
export function ActionsRecu({
  lienWhatsApp,
  message,
  pdfUrl,
  nomFichier,
  numero,
  escposUrl,
  peutImprimer,
  suite,
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
        <BoutonsImpression
          numero={numero}
          escposUrl={escposUrl}
          pdfUrl={pdfUrl}
        />
      )}
      <Link
        href={suite.href}
        className={`${bouton} bg-brand-strong text-white`}
      >
        {suite.libelle}
      </Link>
    </div>
  );
}
