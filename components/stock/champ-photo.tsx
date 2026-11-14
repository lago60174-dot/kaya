"use client";

import { useState } from "react";
import {
  compresserImage,
  envoyerImage,
  rendreLisible,
} from "@/lib/images/navigateur";
import { demanderUrlEnvoiAction } from "@/server/stock/actions";

interface Props {
  imageCle?: string | null;
  vignetteCle?: string | null;
}

/** Compresse la photo dans le navigateur (WebP, 800 px, moins de 100 Ko) puis l'envoie directement vers R2. */
export function ChampPhoto({ imageCle, vignetteCle }: Props) {
  const [image, setImage] = useState(imageCle ?? "");
  const [vignette, setVignette] = useState(vignetteCle ?? "");
  const [etat, setEtat] = useState<"repos" | "envoi">("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    setEtat("envoi");
    try {
      const source = await rendreLisible(fichier);
      const [photo, mini] = await Promise.all([
        compresserImage(source, "photo"),
        compresserImage(source, "vignette"),
      ]);
      const [cleImage, cleVignette] = await Promise.all([
        envoyerImage(photo, "photo", demanderUrlEnvoiAction),
        envoyerImage(mini, "vignette", demanderUrlEnvoiAction),
      ]);
      setImage(cleImage);
      setVignette(cleVignette);
    } catch (e) {
      setErreur(
        e instanceof Error ? e.message : "La photo n'a pas pu être envoyée.",
      );
    } finally {
      setEtat("repos");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Photo (facultatif)</span>
      <div className="flex items-center gap-3">
        {vignette ? (
          // Vignette déjà optimisée en WebP (200 px, moins de 15 Ko) : pas besoin du composant Image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/img/${vignette}`}
            alt="Aperçu du produit"
            width={64}
            height={64}
            className="border-border size-16 rounded-lg border object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="border-border text-muted grid size-16 place-items-center rounded-lg border border-dashed"
          >
            Photo
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          disabled={etat === "envoi"}
          onChange={(e) => void choisir(e.target.files?.[0])}
          className="text-sm"
        />
      </div>
      {etat === "envoi" && (
        <p role="status" className="text-muted text-sm">
          Allègement et envoi de la photo…
        </p>
      )}
      {erreur && (
        <p role="alert" className="text-danger text-sm">
          {erreur}
        </p>
      )}
      {image && (
        <button
          type="button"
          onClick={() => {
            setImage("");
            setVignette("");
          }}
          className="text-muted self-start text-sm underline"
        >
          Retirer la photo
        </button>
      )}
      <input type="hidden" name="imageCle" value={image} />
      <input type="hidden" name="vignetteCle" value={vignette} />
    </div>
  );
}
