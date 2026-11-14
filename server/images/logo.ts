import "server-only";
import type { LogoPdf } from "@/lib/ventes/pdf";
import { typeDeCle } from "./cles";
import { bucketImages } from "./bucket";

/** Logo d'une boutique pour le PDF. Null si absent, illisible ou R2 indisponible : le reçu se génère sans logo. */
export async function lireLogoPdf(
  cle: string | null | undefined,
): Promise<LogoPdf | null> {
  if (!cle || typeDeCle(cle) !== "logo") return null;
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
