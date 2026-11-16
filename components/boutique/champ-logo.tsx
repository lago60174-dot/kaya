"use client";

import { useRef, useState, useTransition } from "react";
import {
  compresserPng,
  envoyerImage,
  type TypePng,
} from "@/lib/images/navigateur";
import { demanderUrlEnvoiAction } from "@/server/stock/actions";
import { definirImageBoutiqueAction } from "@/server/boutique/actions";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

const TEXTES: Record<
  TypePng,
  { vide: string; ajouter: string; changer: string; retirer: string; alt: string }
> = {
  logo: {
    vide: "Aucun logo. Le reçu affiche le nom de la boutique.",
    ajouter: "Ajouter un logo",
    changer: "Changer le logo",
    retirer: "Retirer le logo",
    alt: "Logo actuel",
  },
  signature: {
    vide: "Aucune signature. Photographiez votre signature sur une feuille blanche.",
    ajouter: "Photographier ma signature",
    changer: "Changer la signature",
    retirer: "Retirer la signature",
    alt: "Signature actuelle",
  },
  cachet: {
    vide: "Aucun cachet. Photographiez l'empreinte de votre cachet sur une feuille blanche.",
    ajouter: "Photographier mon cachet",
    changer: "Changer le cachet",
    retirer: "Retirer le cachet",
    alt: "Cachet actuel",
  },
};

/**
 * Logo, signature ou cachet : réduit en PNG sur le téléphone avant l'envoi (jamais de grosse image).
 * Pour la signature et le cachet, le fond de la feuille est retiré : une simple photo suffit.
 */
export function ChampLogo({
  type = "logo",
  logoUrl,
}: {
  type?: TypePng;
  logoUrl: string | null;
}) {
  const t = TEXTES[type];
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const champ = useRef<HTMLInputElement>(null);

  function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    demarrer(async () => {
      try {
        const blob = await compresserPng(fichier, type);
        const cle = await envoyerImage(blob, type, demanderUrlEnvoiAction);
        const r = await definirImageBoutiqueAction(type, cle);
        if (r.erreur) setErreur(r.erreur);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L'envoi de l'image a échoué.");
      } finally {
        if (champ.current) champ.current.value = "";
      }
    });
  }

  function retirer() {
    setErreur(null);
    demarrer(async () => {
      const r = await definirImageBoutiqueAction(type, null);
      if (r.erreur) setErreur(r.erreur);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={t.alt}
          className="max-h-24 max-w-52 rounded border border-dashed border-border bg-white object-contain p-1"
        />
      ) : (
        <p className="text-muted">{t.vide}</p>
      )}
      <label className={`${bouton} cursor-pointer`}>
        {enCours ? "Envoi en cours…" : logoUrl ? t.changer : t.ajouter}
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
        <button type="button" disabled={enCours} onClick={retirer} className={bouton}>
          {t.retirer}
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
