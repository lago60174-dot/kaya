export interface Conditionnement {
  nom: string;
  facteur: number;
}

export interface ProduitCatalogue {
  ref: string;
  categorie: string;
  sousCategorie: string;
  /** Nom sans la marque. */
  nom: string;
  marque: string | null;
  uniteBase: string;
  conditionnements: Conditionnement[];
  caracteristiques: string;
  synonymes: string[];
  /** Nom de fichier (sans extension) dans catalogue/images (R2 : catalogue/<nom>.webp), ou null : la photo est à ajouter dans la boutique. */
  image: string | null;
  /** Donnée peu fiable ou à confirmer avec le commerçant : signalée dans l'écran de sélection. */
  aVerifier: boolean;
  note: string;
}
