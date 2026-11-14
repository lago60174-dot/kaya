import {
  chercherQualite,
  dimensionsCibles,
  empreinteHex,
  LIMITES_IMAGE,
  MIME_IMAGE,
  TAILLE_MAX_ORIGINE,
  verifierFichierImage,
  type TypeImage,
} from "./compression";

const MESSAGE_ILLISIBLE =
  "Cette photo n'a pas pu être lue. Essayez une autre photo (JPEG ou PNG).";

/** Les marques de fichiers HEIC/HEIF (photos de téléphone) : octets 4 à 12 = « ftyp » + marque. */
async function estHeic(fichier: File): Promise<boolean> {
  if (/\.(heic|heif)$/i.test(fichier.name) || /hei[cf]/i.test(fichier.type))
    return true;
  const tete = new Uint8Array(await fichier.slice(0, 12).arrayBuffer());
  const texte = String.fromCharCode(...tete.slice(4, 12));
  return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(texte);
}

/**
 * Rend une photo lisible par le navigateur. Les photos HEIC (téléphones Android et iPhone) ne s'ouvrent pas partout :
 * on les convertit en JPEG une seule fois, avant la compression. Le convertisseur ne se charge que dans ce cas.
 */
export async function rendreLisible(fichier: File): Promise<File> {
  if (fichier.size > TAILLE_MAX_ORIGINE)
    throw new Error("Cette photo est trop lourde (25 Mo maximum).");
  try {
    (await createImageBitmap(fichier)).close();
    return fichier;
  } catch {
    if (!(await estHeic(fichier))) throw new Error(MESSAGE_ILLISIBLE);
  }
  try {
    const { heicTo } = await import("heic-to/next");
    const jpeg = await heicTo({ blob: fichier, type: "image/jpeg", quality: 0.9 });
    return new File([jpeg], fichier.name.replace(/\.(heic|heif)$/i, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    throw new Error(
      "Cette photo HEIC n'a pas pu être convertie. Envoyez une autre photo, ou réglez l'appareil photo sur le format le plus compatible (JPEG).",
    );
  }
}

async function ouvrirImage(fichier: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(fichier);
  } catch {
    throw new Error(MESSAGE_ILLISIBLE);
  }
}

/** Redimensionne puis encode en WebP dans le navigateur, en réduisant jusqu'à passer sous la limite d'octets. */
export async function compresserImage(
  fichier: File,
  type: TypeImage,
): Promise<Blob> {
  const verification = verifierFichierImage(fichier);
  if (!verification.ok) throw new Error(verification.message);
  const { largeur: maxLargeur, octets } = LIMITES_IMAGE[type];
  const bitmap = await ouvrirImage(fichier);
  try {
    for (const echelle of [1, 0.8, 0.6, 0.45]) {
      const { largeur, hauteur } = dimensionsCibles(
        bitmap.width,
        bitmap.height,
        Math.round(maxLargeur * echelle),
      );
      const canvas = document.createElement("canvas");
      canvas.width = largeur;
      canvas.height = hauteur;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, largeur, hauteur);
      const blob = await chercherQualite(
        (q) =>
          new Promise<Blob>((ok, ko) =>
            canvas.toBlob(
              (b) => (b ? ok(b) : ko(new Error("Encodage impossible."))),
              "image/webp",
              q,
            ),
          ),
        octets,
      );
      if (blob && blob.type === "image/webp") return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(
    "Cette photo n'a pas pu être allégée. Essayez une autre photo.",
  );
}

interface ReponseUrl {
  url?: string;
  cle?: string;
  erreur?: string;
}

/** Envoie le fichier directement vers R2 avec une URL signée de courte durée. Renvoie la clé du fichier. */
export async function envoyerImage(
  blob: Blob,
  type: TypeImage,
  demanderUrl: (a: {
    hash: string;
    type: TypeImage;
    taille: number;
  }) => Promise<ReponseUrl>,
): Promise<string> {
  const reponse = await demanderUrl({
    hash: await empreinteHex(blob),
    type,
    taille: blob.size,
  });
  if (!reponse.url || !reponse.cle)
    throw new Error(reponse.erreur ?? "L'envoi de la photo a échoué.");
  let envoi: Response;
  try {
    envoi = await fetch(reponse.url, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": MIME_IMAGE[type] },
    });
  } catch {
    // « Failed to fetch » : le navigateur n'a pas pu joindre R2 (CORS du bucket, mauvais R2_ACCOUNT_ID ou réseau coupé).
    throw new Error(
      "La photo n'a pas pu être envoyée vers le stockage. Vérifiez votre connexion ; si le problème continue, la configuration CORS du bucket R2 est à corriger (voir docs/R2.md).",
    );
  }
  if (!envoi.ok)
    throw new Error(
      "L'envoi de la photo a échoué. Vérifiez votre connexion et réessayez.",
    );
  return reponse.cle;
}

/**
 * Logo : réduit à 300 px de large et encodé en PNG (le PDF ne lit pas le WebP), en gardant la transparence.
 * Le PNG n'a pas de réglage de qualité : on réduit la taille par paliers jusqu'à passer sous la limite.
 */
export async function compresserLogo(fichier: File): Promise<Blob> {
  const verification = verifierFichierImage(fichier);
  if (!verification.ok) throw new Error(verification.message);
  const { largeur: maxLargeur, octets } = LIMITES_IMAGE.logo;
  const bitmap = await ouvrirImage(fichier);
  try {
    for (const echelle of [1, 0.75, 0.55, 0.4, 0.28]) {
      const { largeur, hauteur } = dimensionsCibles(
        bitmap.width,
        bitmap.height,
        Math.round(maxLargeur * echelle),
      );
      const canvas = document.createElement("canvas");
      canvas.width = largeur;
      canvas.height = hauteur;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, largeur, hauteur);
      const blob = await new Promise<Blob | null>((ok) =>
        canvas.toBlob(ok, "image/png"),
      );
      if (blob && blob.type === "image/png" && blob.size <= octets) return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(
    "Ce logo est trop détaillé pour être allégé. Essayez une image plus simple.",
  );
}
