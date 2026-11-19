import { z } from "zod";

/** « 12,5 » ou « 12.5 » → 12.5 ; vide, négatif, nul ou illisible → null. */
export function lireQuantite(texte: string): number | null {
  const propre = texte.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(propre)) return null;
  const v = Number(propre);
  return v > 0 ? v : null;
}

/** Quantité exprimée dans l'unité de base (arrondie au millième, comme la base de données). */
export function enUniteDeBase(quantite: number, facteur: number): number {
  return Math.round(quantite * facteur * 1000) / 1000;
}

const troisDecimales = (v: number) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6;

export const transfertSchema = z
  .object({
    source: z.uuid(),
    destination: z.uuid(),
    /** Clé d'idempotence : un nouvel essai après coupure ne déplace pas le stock deux fois. */
    cle: z.uuid(),
    note: z.string().trim().max(200, "Cette note est trop longue (200 caractères maximum).").optional(),
    lignes: z
      .array(
        z.object({
          produitId: z.uuid(),
          uniteId: z.uuid().nullable().optional(),
          quantite: z
            .number()
            .positive("La quantité doit être supérieure à zéro.")
            .refine(troisDecimales, "Trois décimales au plus."),
        }),
      )
      .min(1, "Ajoutez au moins un produit à transférer.")
      .max(100, "Un transfert est limité à 100 produits."),
  })
  .refine((v) => v.source !== v.destination, {
    message: "Choisissez deux boutiques différentes.",
    path: ["destination"],
  })
  .refine((v) => new Set(v.lignes.map((l) => l.produitId)).size === v.lignes.length, {
    message: "Un produit ne peut figurer qu'une fois dans un transfert.",
    path: ["lignes"],
  });

export type EntreeTransfert = z.infer<typeof transfertSchema>;
