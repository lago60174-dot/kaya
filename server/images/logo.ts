import "server-only";
import type { LogoPdf } from "@/lib/ventes/pdf";
import { typeDeCle } from "./cles";
import { bucketImages } from "./bucket";

type TypePng = "logo" | "signature" | "cachet";

/** Image PNG d'une boutique (logo, signature, cachet) pour le PDF. Null si absente ou illisible : le reçu se génère sans. */
export async function lireImagePdf(
  cle: string | null | undefined,
  type: TypePng,
): Promise<LogoPdf | null> {
  if (!cle || typeDeCle(cle) !== type) return null;
  try {
    const objet = await bucketImages()?.get(cle);
    if (!objet) return null;
    return {
      octets: new Uint8Array(await objet.arrayBuffer()),
      format: "png",
    };
  } catch {
    return null;
  }
}

/** Logo d'une boutique pour le PDF. */
export const lireLogoPdf = (cle: string | null | undefined) =>
  lireImagePdf(cle, "logo");

/** Logo, signature et cachet en une fois. */
export async function lireImagesRecuPdf(boutique: {
  logoCle?: string | null;
  signatureCle?: string | null;
  cachetCle?: string | null;
}) {
  const [logo, signature, cachet] = await Promise.all([
    lireImagePdf(boutique.logoCle, "logo"),
    lireImagePdf(boutique.signatureCle, "signature"),
    lireImagePdf(boutique.cachetCle, "cachet"),
  ]);
  return { logo, signature, cachet };
}
