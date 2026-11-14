import { z } from "zod";
import { estJourValide, MONTANT_MAX } from "./caisse";

const montant = z
  .number({ error: "Entrez un montant en FCFA." })
  .int("Le montant doit être en FCFA, sans décimales.")
  .max(MONTANT_MAX, "Ce montant est trop élevé. Vérifiez-le.");

export const depenseSchema = z.object({
  cle: z.uuid(),
  categorie: z.enum(
    ["transport", "electricite", "salaire", "autre"],
    "Choisissez une catégorie.",
  ),
  montant: montant.positive("Le montant doit être supérieur à zéro."),
  mode: z.enum(
    ["especes", "mtn_momo", "orange_money"],
    "Choisissez un mode de paiement.",
  ),
  note: z
    .string()
    .trim()
    .max(200, "La note est trop longue (200 caractères maximum).")
    .optional(),
});

export const clotureSchema = z.object({
  date: z.string().refine(estJourValide, "Date invalide."),
  especesComptees: montant.min(
    0,
    "Le montant compté ne peut pas être négatif.",
  ),
});

export const validationClotureSchema = z.object({ clotureId: z.uuid() });
