import { LIMITES_IMAGE, type TypeImage } from "@/lib/images/compression";

/** Ce dont on a besoin du binding R2 (simulable dans les tests). */
export interface BucketLu {
  head(cle: string): Promise<{ size: number } | null>;
  get(
    cle: string,
    options?: { range: { offset: number; length: number } },
  ): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(cle: string): Promise<void>;
}

export type ResultatVerification =
  { ok: true } | { ok: false; message: string };

/** Contrôle après envoi : le fichier existe, n'est pas trop lourd et est réellement du WebP. Sinon il est supprimé. */
export async function verifierImageStockee(
  bucket: BucketLu,
  cle: string,
  type: TypeImage,
): Promise<ResultatVerification> {
  const objet = await bucket.head(cle);
  if (!objet)
    return { ok: false, message: "La photo n'a pas été reçue. Réessayez." };
  const limite = LIMITES_IMAGE[type].octets;
  let valide = objet.size <= limite;
  if (valide) {
    const debut = await bucket.get(cle, { range: { offset: 0, length: 12 } });
    const o = debut
      ? new Uint8Array(await debut.arrayBuffer())
      : new Uint8Array();
    const texte = (de: number, a: number) =>
      String.fromCharCode(...o.slice(de, a));
    valide =
      o.length === 12 && texte(0, 4) === "RIFF" && texte(8, 12) === "WEBP";
  }
  if (!valide) {
    await bucket.delete(cle);
    return {
      ok: false,
      message:
        "Cette photo n'est pas valide (format ou poids). Choisissez-en une autre.",
    };
  }
  return { ok: true };
}
