import { z } from "zod";
import { normaliserTelephoneCm } from "@/lib/auth/schemas";

export const MODES_VERSEMENT = ["mtn", "orange"] as const;
export type ModeVersement = (typeof MODES_VERSEMENT)[number];

export const LIBELLE_MODE_VERSEMENT: Record<ModeVersement, string> = {
  mtn: "MTN Mobile Money",
  orange: "Orange Money",
};

export const demandePartenaireSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Entrez votre nom.")
    .max(80, "Ce nom est trop long."),
  telephone: z
    .string()
    .trim()
    .refine(
      (v) => normaliserTelephoneCm(v) !== null,
      "Entrez un numéro camerounais valide, par exemple 699 12 34 56.",
    )
    .transform((v) => normaliserTelephoneCm(v) as string),
  modeVersement: z.enum(MODES_VERSEMENT, {
    error: "Choisissez MTN Mobile Money ou Orange Money.",
  }),
});
