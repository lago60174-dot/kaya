import { z } from "zod";
import { lireMontant, lireQuantite } from "./quantites";

const uuid = z.uuid("Identifiant invalide.");
const vide = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const quantite = (message: string, autoriserZero = false) =>
  z
    .string()
    .refine((v) => lireQuantite(v, { autoriserZero }) !== null, message)
    .transform((v) => lireQuantite(v, { autoriserZero }) as number);

const montant = (message: string) =>
  z
    .string()
    .refine((v) => lireMontant(v) !== null, message)
    .transform((v) => lireMontant(v) as number);

const CLE_IMAGE = /^[0-9a-f-]{36}\/[0-9a-f]{64}(-v)?\.webp$/;

const uniteSchema = z.object({
  id: z.preprocess(vide, uuid.optional()),
  nom: z
    .string()
    .trim()
    .min(1, "Donnez un nom à chaque unité.")
    .max(30, "Ce nom d'unité est trop long."),
  facteur: quantite(
    "Le facteur doit être un nombre supérieur à zéro (ex. 50).",
  ),
  prixVente: montant("Entrez un prix de vente en FCFA, sans décimales."),
});

const unitesJson = z
  .string()
  .transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Les unités de vente sont illisibles.",
      });
      return z.NEVER;
    }
  })
  .pipe(z.array(uniteSchema).min(1, "Ajoutez au moins une unité de vente."))
  .refine(
    (u) => new Set(u.map((x) => x.nom.toLowerCase())).size === u.length,
    "Deux unités portent le même nom.",
  );

export const produitSchema = z.object({
  id: z.preprocess(vide, uuid.optional()),
  nom: z
    .string()
    .trim()
    .min(2, "Entrez le nom du produit.")
    .max(120, "Ce nom est trop long."),
  categorieId: z.preprocess(vide, uuid.optional()),
  marqueId: z.preprocess(vide, uuid.optional()),
  nouvelleMarque: z.preprocess(
    vide,
    z.string().trim().max(60, "Ce nom de marque est trop long.").optional(),
  ),
  nouvelleCategorie: z.preprocess(
    vide,
    z.string().trim().max(60, "Ce nom de catégorie est trop long.").optional(),
  ),
  uniteBase: z
    .string()
    .trim()
    .min(1, "Entrez l'unité de base (kg, barre, pièce…).")
    .max(30, "Cette unité est trop longue."),
  seuilAlerte: quantite("Entrez un seuil d'alerte (0 si aucun).", true),
  prixAchat: montant("Entrez un prix d'achat en FCFA, sans décimales."),
  unites: unitesJson,
  imageCle: z.preprocess(
    vide,
    z.string().regex(CLE_IMAGE, "Photo invalide.").optional(),
  ),
  vignetteCle: z.preprocess(
    vide,
    z.string().regex(CLE_IMAGE, "Photo invalide.").optional(),
  ),
  codeBarres: z.preprocess(vide, z.string().trim().max(40).optional()),
  actif: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const mouvementSchema = z
  .object({
    boutiqueId: uuid,
    produitId: uuid,
    type: z.enum(
      ["entree", "perte", "inventaire"],
      "Choisissez une opération.",
    ),
    uniteId: z.preprocess(vide, uuid.optional()),
    quantite: z.string(),
    motif: z.preprocess(
      vide,
      z.string().trim().max(200, "Ce motif est trop long.").optional(),
    ),
    prixAchat: z.preprocess(
      vide,
      montant("Entrez un prix d'achat en FCFA, sans décimales.").optional(),
    ),
  })
  .superRefine((v, ctx) => {
    const n = lireQuantite(v.quantite, {
      autoriserZero: v.type === "inventaire",
    });
    if (n === null)
      ctx.addIssue({
        code: "custom",
        path: ["quantite"],
        message: "Entrez une quantité valide (ex. 12 ou 2,5).",
      });
    if (v.type === "perte" && !v.motif)
      ctx.addIssue({
        code: "custom",
        path: ["motif"],
        message: "Indiquez le motif de la perte ou de la casse.",
      });
  })
  .transform((v) => ({
    ...v,
    quantite: lireQuantite(v.quantite, {
      autoriserZero: v.type === "inventaire",
    }) as number,
  }));
