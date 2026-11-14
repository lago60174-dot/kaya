import { z } from "zod";
import { normaliserTelephoneCm } from "@/lib/auth/schemas";

const MONTANT_MAX = 100_000_000;
const ECART_MAX = 10_000_000;

/** Entier FCFA saisi dans un champ texte (espaces tolérés). */
const montant = (max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s  ]/g, ""))
    .pipe(
      z
        .string()
        .regex(/^\d{1,12}$/, message)
        .transform(Number)
        .pipe(z.number().max(max, message)),
    );

/** Pourcentage de 0 à 100, deux décimales au plus, virgule ou point. */
const pourcentage = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,3}(\.\d{1,2})?$/,
        "Entrez un pourcentage entre 0 et 100 (deux décimales au plus).",
      )
      .transform(Number)
      .pipe(z.number().max(100, "Le seuil ne peut pas dépasser 100 %.")),
  );

const vide = (v: string) => (v.trim() === "" ? undefined : v.trim());

export const parametresSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Entrez le nom de la boutique (2 caractères au minimum).")
    .max(80, "Ce nom est trop long (80 caractères maximum)."),
  adresse: z
    .string()
    .transform(vide)
    .pipe(
      z
        .string()
        .max(160, "L'adresse est trop longue (160 caractères maximum).")
        .optional(),
    ),
  telephone: z
    .string()
    .transform(vide)
    .pipe(
      z
        .string()
        .refine(
          (v) => normaliserTelephoneCm(v) !== null,
          "Entrez un numéro camerounais valide, par exemple 699 12 34 56.",
        )
        .transform((v) => normaliserTelephoneCm(v) as string)
        .optional(),
    ),
  mentionLegale: z
    .string()
    .transform(vide)
    .pipe(
      z
        .string()
        .max(
          300,
          "Le message de pied de reçu est trop long (300 caractères maximum).",
        )
        .optional(),
    ),
  seuilRemise: pourcentage,
  plafondCredit: montant(
    MONTANT_MAX,
    "Entrez un plafond en FCFA (nombre entier, 100 000 000 au maximum).",
  ),
  stockNegatif: z.enum(["oui", "non"]).transform((v) => v === "oui"),
  ecartTolere: montant(
    ECART_MAX,
    "Entrez un écart en FCFA (nombre entier, 10 000 000 au maximum).",
  ),
});

export type ParametresSaisis = z.infer<typeof parametresSchema>;
