import { z } from "zod";

/** Ce qu'affichent le reçu à l'écran, le PDF et le message WhatsApp. Jamais de coût d'achat ni de marge. */
export interface RecuAffichable {
  numeroRecu: string;
  date: string;
  annule: boolean;
  sousTotal?: number;
  remise: number;
  total: number;
  boutique: {
    nom: string;
    adresse: string | null;
    telephone: string | null;
    mentionLegale: string | null;
    /** Clé R2 du logo (PNG), si la boutique en a un. */
    logoCle?: string | null;
  };
  client: { nom: string; telephone: string | null } | null;
  lignes: {
    nom: string;
    unite: string;
    quantite: number;
    prixUnitaire: number;
    remiseLigne: number;
    total: number;
  }[];
  paiements: { mode: string; montant: number }[];
  /** Reste dû par le client sur cette vente aujourd'hui. */
  credit: number;
  /** Présent seulement dans l'application (le motif d'annulation n'est pas public). */
  avoir?: { numero: string; motif: string; date: string } | null;
}

export interface RecuDetail extends RecuAffichable {
  id: string;
  jetonPublic: string;
}

const nombre = z.coerce.number();

const publicSchema = z.object({
  numero_recu: z.string(),
  date: z.string(),
  annule: z.boolean(),
  remise: nombre,
  total: nombre,
  boutique: z.object({
    nom: z.string(),
    adresse: z.string().nullable(),
    telephone: z.string().nullable(),
    mention_legale: z.string().nullable(),
    logo_cle: z.string().nullable().optional(),
  }),
  client_nom: z.string().nullable(),
  lignes: z.array(
    z.object({
      nom: z.string(),
      unite: z.string(),
      quantite: nombre,
      prix_unitaire: nombre,
      remise_ligne: nombre,
      total: nombre,
    }),
  ),
  paiements: z.array(z.object({ mode: z.string(), montant: nombre })),
  credit: nombre,
});

/** Convertit la réponse de la fonction SQL `recu_public`. Lève une erreur si sa forme change (mieux qu'un reçu faux). */
export function recuPublicDepuisJson(json: unknown): RecuAffichable {
  const r = publicSchema.parse(json);
  return {
    numeroRecu: r.numero_recu,
    date: r.date,
    annule: r.annule,
    remise: r.remise,
    total: r.total,
    boutique: {
      nom: r.boutique.nom,
      adresse: r.boutique.adresse,
      telephone: r.boutique.telephone,
      mentionLegale: r.boutique.mention_legale,
      logoCle: r.boutique.logo_cle ?? null,
    },
    client: r.client_nom ? { nom: r.client_nom, telephone: null } : null,
    lignes: r.lignes.map((l) => ({
      nom: l.nom,
      unite: l.unite,
      quantite: l.quantite,
      prixUnitaire: l.prix_unitaire,
      remiseLigne: l.remise_ligne,
      total: l.total,
    })),
    paiements: r.paiements,
    credit: r.credit,
  };
}
