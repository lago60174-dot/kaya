import type { ProduitVente } from "./panier";

/** Ligne renvoyée par lister_produits. */
export interface LigneProduitListe {
  id: string;
  nom_affiche: string;
  unite_base: string;
  stock: number | string;
  actif: boolean;
  unites: {
    id: string;
    nom: string;
    facteur: number | string;
    prix_vente: number | string;
  }[];
}

/** Produits proposés à la vente : actifs, avec au moins une unité. Le prix d'achat n'est jamais présent. */
export function versProduitsVente(lignes: LigneProduitListe[]): ProduitVente[] {
  return lignes
    .filter((l) => l.actif && l.unites.length > 0)
    .map((l) => ({
      id: l.id,
      nom: l.nom_affiche,
      uniteBase: l.unite_base,
      stock: Number(l.stock),
      unites: l.unites.map((u) => ({
        id: u.id,
        nom: u.nom,
        facteur: Number(u.facteur),
        prixVente: Number(u.prix_vente),
      })),
    }));
}
