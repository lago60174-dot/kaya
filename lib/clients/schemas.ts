import { z } from "zod";
import { normaliserTelephoneCm } from "@/lib/auth/schemas";
import { lireMontant } from "@/lib/stock/quantites";

const vide = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const telephone = z.preprocess(
  vide,
  z
    .string()
    .trim()
    .refine(
      (v) => normaliserTelephoneCm(v) !== null,
      "Entrez un numéro camerounais valide, par exemple 699 12 34 56.",
    )
    .transform((v) => normaliserTelephoneCm(v) as string)
    .optional(),
);

/** Fiche client. Le plafond de crédit n'est lu que pour le propriétaire (la base le refuse au vendeur de toute façon). */
export const clientSchema = z.object({
  id: z.preprocess(vide, z.uuid().optional()),
  nom: z
    .string()
    .trim()
    .min(2, "Entrez le nom du client.")
    .max(80, "Ce nom est trop long."),
  telephone,
  notes: z.preprocess(
    vide,
    z
      .string()
      .trim()
      .max(500, "Ces notes sont trop longues (500 caractères maximum).")
      .optional(),
  ),
  plafondCredit: z.preprocess(
    vide,
    z
      .string()
      .refine(
        (v) => lireMontant(v) !== null,
        "Entrez un plafond en FCFA, sans décimales.",
      )
      .transform((v) => lireMontant(v) as number)
      .optional(),
  ),
});

export const paiementCreditSchema = z.object({
  clientId: z.uuid(),
  cle: z.uuid(),
  mode: z.enum(
    ["especes", "mtn_momo", "orange_money"],
    "Choisissez un mode de paiement.",
  ),
  montant: z
    .number()
    .int("Le montant doit être en FCFA, sans décimales.")
    .positive("Le montant doit être supérieur à zéro."),
});
