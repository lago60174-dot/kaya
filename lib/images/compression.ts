export const LIMITES_IMAGE = {
  photo: { largeur: 800, octets: 100 * 1024 },
  vignette: { largeur: 200, octets: 15 * 1024 },
  /** Logo de la boutique : PNG (le PDF ne lit pas le WebP), plus petit qu'une photo, il se répète sur chaque reçu. */
  logo: { largeur: 300, octets: 40 * 1024 },
  /** Signature et cachet : PNG transparent (fond blanc retiré sur le téléphone), posés au bas de chaque reçu. */
  signature: { largeur: 320, octets: 40 * 1024 },
  cachet: { largeur: 260, octets: 40 * 1024 },
} as const;
export type TypeImage = keyof typeof LIMITES_IMAGE;

/** Format de stockage de chaque type d'image. */
export const MIME_IMAGE: Record<TypeImage, "image/webp" | "image/png"> = {
  photo: "image/webp",
  vignette: "image/webp",
  logo: "image/png",
  signature: "image/png",
  cachet: "image/png",
};

/** Photo brute acceptée avant compression (un téléphone récent dépasse souvent 4 Mo). */
export const TAILLE_MAX_ORIGINE = 25 * 1024 * 1024;

/** Réduit pour tenir dans `max` pixels de large, sans jamais agrandir. */
export function dimensionsCibles(
  largeur: number,
  hauteur: number,
  max: number,
): { largeur: number; hauteur: number } {
  if (largeur <= max) return { largeur, hauteur };
  return {
    largeur: max,
    hauteur: Math.max(1, Math.round((hauteur * max) / largeur)),
  };
}

export type Encodeur = (qualite: number) => Promise<Blob>;

/** Cherche la meilleure qualité dont le fichier tient dans `octetsMax`. Null si même la plus basse est trop lourde. */
export async function chercherQualite(
  encoder: Encodeur,
  octetsMax: number,
  bornes: { min: number; max: number } = { min: 0.3, max: 0.92 },
): Promise<Blob | null> {
  const haut = await encoder(bornes.max);
  if (haut.size <= octetsMax) return haut;
  const bas = await encoder(bornes.min);
  if (bas.size > octetsMax) return null;
  let meilleur = bas;
  let min = bornes.min;
  let max = bornes.max;
  for (let i = 0; i < 6; i++) {
    const milieu = (min + max) / 2;
    const essai = await encoder(milieu);
    if (essai.size <= octetsMax) {
      meilleur = essai;
      min = milieu;
    } else {
      max = milieu;
    }
  }
  return meilleur;
}

export type VerificationFichier = { ok: true } | { ok: false; message: string };

export function verifierFichierImage(fichier: {
  type: string;
  size: number;
}): VerificationFichier {
  if (!fichier.type.startsWith("image/"))
    return { ok: false, message: "Ce fichier n'est pas une image." };
  if (fichier.size > TAILLE_MAX_ORIGINE)
    return {
      ok: false,
      message: "Cette photo est trop lourde (25 Mo maximum).",
    };
  return { ok: true };
}

/** Empreinte SHA-256 en hexadécimal : sert de nom de fichier unique. */
export async function empreinteHex(blob: Blob): Promise<string> {
  const octets = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(octets), (o) =>
    o.toString(16).padStart(2, "0"),
  ).join("");
}
