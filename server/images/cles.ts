import type { TypeImage } from "@/lib/images/compression";

/** Photo du catalogue modèle : même bucket R2, dossier `catalogue/` commun à toutes les boutiques (rien à copier par boutique). */
export const CLE_CATALOGUE = /^catalogue\/[a-z0-9-]+(-v)?\.webp$/;

export const estCleCatalogue = (cle: string) => CLE_CATALOGUE.test(cle);

export const CLE_VALIDE =
  /^([0-9a-f-]{36}\/[0-9a-f]{64}(-v\.webp|\.webp|-l\.png|-s\.png|-c\.png)|catalogue\/[a-z0-9-]+(-v)?\.webp)$/;

const SUFFIXE: Record<TypeImage, string> = {
  photo: ".webp",
  vignette: "-v.webp",
  logo: "-l.png",
  signature: "-s.png",
  cachet: "-c.png",
};

/** Type de fichier d'une clé (d'après son suffixe), ou null si la clé n'est pas valide. */
export function typeDeCle(cle: string): TypeImage | null {
  if (!CLE_VALIDE.test(cle)) return null;
  if (cle.endsWith("-l.png")) return "logo";
  if (cle.endsWith("-s.png")) return "signature";
  if (cle.endsWith("-c.png")) return "cachet";
  return cle.endsWith("-v.webp") ? "vignette" : "photo";
}

/** Clé du fichier dans R2 : dossier de l'organisation + empreinte du contenu. Un contenu identique garde la même clé. */
export function construireCle(
  organisationId: string,
  hash: string,
  type: TypeImage,
): string | null {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  return `${organisationId}/${hash}${SUFFIXE[type]}`;
}

export function cleAppartient(
  cle: string,
  organisationId: string,
  type: TypeImage,
): boolean {
  if (estCleCatalogue(cle))
    return (type === "vignette") === cle.endsWith("-v.webp");
  return typeDeCle(cle) === type && cle.startsWith(`${organisationId}/`);
}

export const urlImage = (cle: string) => `/img/${cle}`;
