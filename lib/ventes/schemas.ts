import { z } from "zod";
import { normaliserTelephoneCm } from "@/lib/auth/schemas";

const uuid = z.uuid();

export const venteSchema = z.object({
  cle: uuid,
  /** Boutique de la vente (gardée avec la vente faite sans réseau). */
  boutiqueId: uuid.optional(),
  lignes: z
    .array(
      z.object({
        produitId: uuid,
        uniteId: uuid,
        quantite: z
          .number()
          .positive()
          .max(999999)
          .refine(
            (q) => Math.round(q * 1000) / 1000 === q,
            "3 décimales au maximum.",
          ),
        remiseLigne: z.number().int().min(0).default(0),
      }),
    )
    .min(1, "Ajoutez au moins un article.")
    .max(100, "Trop d'articles dans une même vente."),
  paiements: z
    .array(
      z.object({
        mode: z.enum(["especes", "mtn_momo", "orange_money"]),
        montant: z.number().int().positive().optional(),
      }),
    )
    .max(5),
  clientId: uuid.nullish(),
  remise: z.number().int().min(0).default(0),
  forcer: z.boolean().default(false),
});
export type VenteEntree = z.input<typeof venteSchema>;

export const clientRapideSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Entrez le nom du client.")
    .max(80, "Ce nom est trop long."),
  telephone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normaliserTelephoneCm(v) : undefined))
    .refine(
      (v) => v !== null,
      "Entrez un numéro camerounais valide, par exemple 699 12 34 56.",
    ),
});
