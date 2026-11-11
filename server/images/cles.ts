import type { TypeImage } from "@/lib/images/compression";

export const CLE_VALIDE = /^[0-9a-f-]{36}\/[0-9a-f]{64}(-v)?\.webp$/;

/** Clé du fichier dans R2 : dossier de l'organisation + empreinte du contenu. Un contenu identique garde la même clé. */
export function construireCle(
  organisationId: string,
  hash: string,
  type: TypeImage,
): string | null {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  return `${organisationId}/${hash}${type === "vignette" ? "-v" : ""}.webp`;
}

export function cleAppartient(
  cle: string,
  organisationId: string,
  type: TypeImage,
): boolean {
  return (
    CLE_VALIDE.test(cle) &&
    cle.startsWith(`${organisationId}/`) &&
    cle.endsWith("-v.webp") === (type === "vignette")
  );
}

export const urlImage = (cle: string) => `/img/${cle}`;
