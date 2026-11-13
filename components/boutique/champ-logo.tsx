"use client";

import { useRef, useState, useTransition } from "react";
import { compresserLogo, envoyerImage } from "@/lib/images/navigateur";
import { demanderUrlEnvoiAction } from "@/server/stock/actions";
import { definirLogoAction } from "@/server/boutique/actions";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

/** Choix du logo : réduit à 300 px en PNG sur le téléphone avant l'envoi (jamais de grosse image). */
export function ChampLogo({ logoUrl }: { logoUrl: string | null }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const champ = useRef<HTMLInputElement>(null);

  function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    demarrer(async () => {
      try {
        const blob = await compresserLogo(fichier);
        const cle = await envoyerImage(blob, "logo", demanderUrlEnvoiAction);
        const r = await definirLogoAction(cle);
        if (r.erreur) setErreur(r.erreur);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L'envoi du logo a échoué.");
      } finally {
        if (champ.current) champ.current.value = "";
      }
    });
  }

  function retirer() {
    setErreur(null);
    demarrer(async () => {
      const r = await definirLogoAction(null);
      if (r.erreur) setErreur(r.erreur);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Logo actuel"
          className="max-h-20 max-w-48 object-contain"
        />
      ) : (
        <p className="text-muted">
          Aucun logo. Le reçu affiche le nom de la boutique.
        </p>
      )}
      <label className={`${bouton} cursor-pointer`}>
        {enCours
          ? "Envoi en cours…"
          : logoUrl
            ? "Changer le logo"
            : "Ajouter un logo"}
        <input
          ref={champ}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={enCours}
          className="sr-only"
          onChange={(e) => choisir(e.target.files?.[0])}
        />
      </label>
      {logoUrl && (
        <button
          type="button"
          disabled={enCours}
          onClick={retirer}
          className={bouton}
        >
          Retirer le logo
        </button>
      )}
      {erreur && (
        <p role="alert" className="text-danger text-sm font-semibold">
          {erreur}
        </p>
      )}
    </div>
  );
}
