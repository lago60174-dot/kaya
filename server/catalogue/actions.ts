"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CATALOGUE_PAR_REF,
  cleImageCatalogue,
  cleVignetteCatalogue,
} from "@/lib/catalogue";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";
import { bucketImages } from "@/server/images/bucket";
import { cleAppartient } from "@/server/images/cles";
import { verifierImageStockee } from "@/server/images/verification";

export interface ResultatImport {
  erreur?: string;
  crees?: number;
  ignores?: number;
  /** Créés masqués : aucun prix de vente saisi. */
  sansPrix?: number;
  sansPhoto?: number;
}

const montant = z.number().int().min(0).max(999_999_999_999);

const entreeSchema = z.object({
  ref: z.string().max(20),
  nom: z.string().trim().min(2, "Un nom est trop court.").max(120),
  /** Prix d'achat par unité de base. */
  prixAchat: montant,
  /** Prix de vente par conditionnement : clé = nom du conditionnement du catalogue. 0 ou absent : non vendu ainsi. */
  prixVente: z.record(z.string().max(60), montant),
  /** Photo ajoutée à la main pour un produit sans image au catalogue. */
  imageCle: z.string().max(200).optional(),
  vignetteCle: z.string().max(200).optional(),
});

const importSchema = z.array(entreeSchema).min(1).max(500);

/**
 * Crée dans la boutique les produits cochés dans le catalogue modèle. Le serveur ne croit que ce qui est modifiable
 * (nom, prix, photo) : unité de base, conditionnements, catégorie, marque et images viennent du catalogue.
 * Un produit sans aucun prix de vente est créé masqué, pour ne jamais être vendu à 0 FCFA.
 */
export async function importerCatalogueAction(
  entrees: unknown,
): Promise<ResultatImport> {
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueActiveId;
  if (!profil.organisationId || !boutiqueId)
    return { erreur: "Impossible de charger votre boutique. Reconnectez-vous." };
  const lu = importSchema.safeParse(entrees);
  if (!lu.success)
    return { erreur: "La sélection est invalide. Rechargez la page et réessayez." };

  let sansPrix = 0;
  let sansPhoto = 0;
  const produits = [];
  const vus = new Set<string>();
  for (const e of lu.data) {
    const modele = CATALOGUE_PAR_REF.get(e.ref);
    if (!modele || vus.has(e.ref))
      return { erreur: "La sélection est invalide. Rechargez la page et réessayez." };
    vus.add(e.ref);

    const vendus = modele.conditionnements.filter(
      (c) => (e.prixVente[c.nom] ?? 0) > 0,
    );
    const masque = vendus.length === 0;
    // Sans prix : on garde la vente à l'unité de base (facteur 1, sinon la plus petite) à 0, produit masqué.
    const retenus = masque
      ? [
          [...modele.conditionnements].sort((a, b) => a.facteur - b.facteur)[0],
        ]
      : vendus;
    if (masque) sansPrix++;

    let imageCle: string | null = null;
    let vignetteCle: string | null = null;
    if (modele.image) {
      imageCle = cleImageCatalogue(modele.image);
      vignetteCle = cleVignetteCatalogue(modele.image);
    } else if (e.imageCle && e.vignetteCle) {
      const bucket = bucketImages();
      if (
        !bucket ||
        !cleAppartient(e.imageCle, profil.organisationId, "photo") ||
        !cleAppartient(e.vignetteCle, profil.organisationId, "vignette") ||
        !(await verifierImageStockee(bucket, e.imageCle, "photo")).ok ||
        !(await verifierImageStockee(bucket, e.vignetteCle, "vignette")).ok
      )
        return {
          erreur: `La photo de « ${e.nom} » n'a pas pu être enregistrée. Retirez-la ou réessayez.`,
        };
      imageCle = e.imageCle;
      vignetteCle = e.vignetteCle;
    }
    if (!imageCle) sansPhoto++;

    produits.push({
      ref: e.ref,
      nom: e.nom,
      categorie: modele.categorie,
      marque: modele.marque,
      unite_base: modele.uniteBase,
      prix_achat: e.prixAchat,
      actif: !masque,
      image_cle: imageCle,
      vignette_cle: vignetteCle,
      unites: retenus.map((c) => ({
        nom: c.nom,
        facteur: c.facteur,
        prix_vente: masque ? 0 : (e.prixVente[c.nom] ?? 0),
      })),
    });
  }

  const supabase = await supabaseServeur();
  const { data, error } = await supabase.rpc("importer_catalogue", {
    p_boutique: boutiqueId,
    p_produits: produits,
  });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath("/stock");
  revalidatePath("/demarrage");
  const r = data as { crees?: number; ignores?: number } | null;
  return {
    crees: r?.crees ?? 0,
    ignores: r?.ignores ?? 0,
    sansPrix,
    sansPhoto,
  };
}
