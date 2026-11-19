import { z } from "zod";

const uuid = z.uuid();
const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const texte = (max: number, message: string) =>
  z.string().trim().max(max, message).default("");

const ligne = z.object({
  produitId: uuid,
  uniteId: uuid,
  quantite: z
    .number()
    .positive()
    .max(999999)
    .refine((q) => Math.round(q * 1000) / 1000 === q, "3 décimales au maximum."),
});

/** Devis ou proforma. Aucun prix : la base les relit dans le catalogue. */
export const devisSchema = z.object({
  cle: uuid,
  id: uuid.nullish(),
  type: z.enum(["devis", "proforma"]),
  clientId: uuid.nullish(),
  lignes: z
    .array(ligne)
    .min(1, "Ajoutez au moins un article.")
    .max(100, "Trop d'articles dans un même devis."),
  remise: z.number().int().min(0).default(0),
  valideJusqu: jour,
  conditions: texte(500, "Les conditions sont trop longues (500 caractères maximum)."),
  note: texte(300, "La note est trop longue (300 caractères maximum)."),
  envoyer: z.boolean().default(false),
});
export type DevisEntree = z.input<typeof devisSchema>;

export const conversionSchema = z.object({
  devisId: uuid,
  cle: uuid,
  paiements: z
    .array(
      z.object({
        mode: z.enum(["especes", "mtn_momo", "orange_money"]),
        montant: z.number().int().positive().optional(),
      }),
    )
    .max(5),
  forcer: z.boolean().default(false),
});

export const bonLivraisonSchema = z
  .object({
    venteId: uuid.nullish(),
    devisId: uuid.nullish(),
    adresse: texte(200, "L'adresse est trop longue (200 caractères maximum)."),
    note: texte(300, "La note est trop longue (300 caractères maximum)."),
  })
  .refine((v) => Boolean(v.venteId) !== Boolean(v.devisId), {
    message: "Choisissez une vente ou un devis.",
  });
