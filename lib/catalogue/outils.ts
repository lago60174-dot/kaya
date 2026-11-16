import type { ProduitCatalogue } from "./types";

/** Clés d'image du catalogue : fichiers du dossier catalogue/ de R2, partagés par toutes les boutiques. */
export const cleImageCatalogue = (image: string) => `catalogue/${image}.webp`;
export const cleVignetteCatalogue = (image: string) =>
  `catalogue/${image}-v.webp`;

/** Même normalisation que normaliser_texte() en base : sans accents, en minuscules. */
export function normaliserTexte(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Nom tel qu'il est stocké et recherché en base : « nom · marque ». */
export const nomRecherche = (p: Pick<ProduitCatalogue, "nom" | "marque">) =>
  normaliserTexte(p.marque ? `${p.nom.trim()} · ${p.marque}` : p.nom.trim());
