import {
  chercherQualite,
  dimensionsCibles,
  empreinteHex,
  LIMITES_IMAGE,
  MIME_IMAGE,
  verifierFichierImage,
  type TypeImage,
} from "./compression";

/** Redimensionne puis encode en WebP dans le navigateur, en réduisant jusqu'à passer sous la limite d'octets. */
export async function compresserImage(
  fichier: File,
  type: TypeImage,
): Promise<Blob> {
  const verification = verifierFichierImage(fichier);
  if (!verification.ok) throw new Error(verification.message);
  const { largeur: maxLargeur, octets } = LIMITES_IMAGE[type];
  const bitmap = await createImageBitmap(fichier);
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
  const envoi = await fetch(reponse.url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": MIME_IMAGE[type] },
  });
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
  const bitmap = await createImageBitmap(fichier);
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
