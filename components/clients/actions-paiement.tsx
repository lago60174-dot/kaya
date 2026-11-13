"use client";

import Link from "next/link";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

/** Partage du reçu de paiement par le WhatsApp du vendeur, impression si le plan l'autorise. */
export function ActionsPaiement({
  lienWhatsApp,
  clientId,
  peutImprimer,
}: {
  lienWhatsApp: string;
  clientId: string;
  peutImprimer: boolean;
}) {
  return (
    <div className="recu-actions flex max-w-md flex-col gap-2">
      <a
        href={lienWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className={`${bouton} bg-success text-white`}
      >
        Envoyer le reçu sur WhatsApp
      </a>
      {peutImprimer && (
        <button type="button" onClick={() => window.print()} className={bouton}>
          Imprimer
        </button>
      )}
      <Link
        href={`/clients/${clientId}`}
        className={`${bouton} bg-brand-strong text-white`}
      >
        Retour au client
      </Link>
    </div>
  );
}
