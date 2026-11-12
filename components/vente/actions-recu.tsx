"use client";

import Link from "next/link";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

interface Props {
  lienWhatsApp: string;
  peutImprimer: boolean;
}

/** Les trois suites d'une vente. Le partage et l'impression ne bloquent jamais la vente : elle est déjà enregistrée. */
export function ActionsRecu({ lienWhatsApp, peutImprimer }: Props) {
  return (
    <div className="recu-actions flex max-w-md flex-col gap-2">
      <a
        href={lienWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className={`${bouton} bg-success text-white`}
      >
        Partager sur WhatsApp
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
