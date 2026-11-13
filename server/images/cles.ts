import type { TypeImage } from "@/lib/images/compression";

export const CLE_VALIDE =
  /^[0-9a-f-]{36}\/[0-9a-f]{64}(-v\.webp|\.webp|-l\.png)$/;

const SUFFIXE: Record<TypeImage, string> = {
  photo: ".webp",
  vignette: "-v.webp",
  logo: "-l.png",
};

/** Type de fichier d'une clé (d'après son suffixe), ou null si la clé n'est pas valide. */
export function typeDeCle(cle: string): TypeImage | null {
  if (!CLE_VALIDE.test(cle)) return null;
  return cle.endsWith("-l.png")
    ? "logo"
    : cle.endsWith("-v.webp")
      ? "vignette"
      : "photo";
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
  return typeDeCle(cle) === type && cle.startsWith(`${organisationId}/`);
}

export const urlImage = (cle: string) => `/img/${cle}`;
