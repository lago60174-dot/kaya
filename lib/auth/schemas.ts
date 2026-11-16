import { z } from "zod";
import { normaliserCode } from "./parrainage";

/** "699 12 34 56", "+237699123456", "237699123456" -> "+237699123456". Null si invalide. */
export function normaliserTelephoneCm(brut: string): string | null {
  const chiffres = brut.replace(/[\s.\-()]/g, "").replace(/^(\+|00)/, "");
  const local =
    chiffres.length === 12 && chiffres.startsWith("237")
      ? chiffres.slice(3)
      : chiffres;
  return /^[26]\d{8}$/.test(local) ? `+237${local}` : null;
}

export const motDePasse = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(72, "Le mot de passe est trop long (72 caractères maximum).")
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre.")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Entrez une adresse email valide."));

const telephone = z
  .string()
  .trim()
  .refine(
    (v) => normaliserTelephoneCm(v) !== null,
    "Entrez un numéro camerounais valide, par exemple 699 12 34 56.",
  )
  .transform((v) => normaliserTelephoneCm(v) as string);

export const inscriptionSchema = z.object({
  nomBoutique: z
    .string()
    .trim()
    .min(2, "Entrez le nom de votre boutique.")
    .max(80, "Ce nom est trop long."),
  ville: z
    .string()
    .trim()
    .min(2, "Entrez votre ville.")
    .max(60, "Ce nom de ville est trop long."),
  telephone,
  email,
  motDePasse,
  plan: z
    .string()
    .regex(/^[a-z_]{2,30}$/)
    .optional()
    .catch(undefined),
  codeParrainage: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? normaliserCode(v) : undefined))
    .refine((v) => v !== null, "Ce code de parrainage n'est pas valide."),
});

export const connexionSchema = z.object({
  email,
  motDePasse: z.string().min(1, "Entrez votre mot de passe."),
});

export const creerVendeurSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Entrez le nom du vendeur.")
    .max(80, "Ce nom est trop long."),
  email,
});

export const changerMotDePasseSchema = z
  .object({ nouveau: motDePasse, confirmation: z.string() })
  .refine((v) => v.nouveau === v.confirmation, {
    message: "Les deux mots de passe ne sont pas identiques.",
    path: ["confirmation"],
  });

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const LONGUEUR = 10;

/** Mot de passe provisoire lisible (sans caractères ambigus), avec au moins une lettre et un chiffre. */
export function genererMotDePasseProvisoire(octets: Uint8Array): string {
  if (octets.length < LONGUEUR)
    throw new RangeError("Pas assez d'octets aléatoires.");
  const caracteres = Array.from(
    octets.slice(0, LONGUEUR),
    (o) => ALPHABET[o % ALPHABET.length],
  );
  if (!caracteres.some((c) => /\d/.test(c)))
    caracteres[0] = String(2 + (octets[0] % 8));
  if (!caracteres.some((c) => /[A-Za-z]/.test(c))) caracteres[1] = "K";
  return caracteres.join("");
}
