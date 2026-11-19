import { z } from "zod";

const uuid = z.uuid();
const texte = (max: number, message: string) => z.string().trim().max(max, message).default("");
const mode = z.enum(["especes", "mtn_momo", "orange_money"]);
const quantite = z
  .number()
  .positive("La quantité doit être supérieure à zéro.")
  .max(999999)
  .refine((q) => Math.round(q * 1000) / 1000 === q, "3 décimales au maximum.");

export const fournisseurSchema = z.object({
  id: uuid.nullish(),
  nom: z.string().trim().min(2, "Entrez le nom du fournisseur.").max(80, "Le nom est trop long (80 caractères maximum)."),
  telephone: texte(30, "Le téléphone est trop long."),
  adresse: texte(200, "L'adresse est trop longue (200 caractères maximum)."),
  notes: texte(300, "Les notes sont trop longues (300 caractères maximum)."),
});

export const commandeSchema = z.object({
  cle: uuid,
  fournisseurId: uuid,
  lignes: z
    .array(
      z.object({
        produitId: uuid,
        uniteId: uuid,
        quantite,
        prixAchat: z.number().int("Le prix d'achat est en FCFA, sans décimales.").min(0),
      }),
    )
    .min(1, "Ajoutez au moins un article.")
    .max(100, "Trop d'articles dans une même commande."),
  note: texte(300, "La note est trop longue (300 caractères maximum)."),
});

export const receptionSchema = z.object({
  commandeId: uuid,
  cle: uuid,
  lignes: z
    .array(z.object({ commandeLigneId: uuid, quantite }))
    .min(1, "Indiquez les quantités reçues."),
  paye: z.number().int().min(0).default(0),
  mode: mode.default("especes"),
});

export const paiementDetteSchema = z.object({
  detteId: uuid,
  cle: uuid,
  montant: z.number().int().positive("Entrez un montant supérieur à zéro."),
  mode,
});
