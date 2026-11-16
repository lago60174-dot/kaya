import lot1 from "./lot-1.json";
import lot2 from "./lot-2.json";
import type { Conditionnement, ProduitCatalogue } from "./types";

export * from "./outils";
export type { Conditionnement, ProduitCatalogue } from "./types";

interface LigneLot {
  ref: string;
  categorie: string;
  sous_categorie: string;
  nom: string;
  marque: string;
  unite_base: string;
  conditionnements: Conditionnement[];
  caracteristiques: string;
  synonymes_locaux: string[];
  image: string | null;
  confiance: string;
  notes: string;
  propose_par_defaut: boolean;
}

/** Tous les lots du catalogue modèle. Pour en ajouter un : voir catalogue/README.md. */
const LOTS: LigneLot[][] = [lot1 as LigneLot[], lot2 as LigneLot[]];

/** Valeurs de la colonne marque qui disent « pas de marque connue » : le commerçant la saisit s'il en a une. */
const SANS_MARQUE = new Set(["Sans marque", "À CONFIRMER"]);

export const CATALOGUE: ProduitCatalogue[] = LOTS.flat().map((l) => ({
  ref: l.ref,
  categorie: l.categorie,
  sousCategorie: l.sous_categorie,
  nom: l.nom,
  marque: SANS_MARQUE.has(l.marque) ? null : l.marque,
  uniteBase: l.unite_base,
  conditionnements: l.conditionnements,
  caracteristiques: l.caracteristiques,
  synonymes: l.synonymes_locaux,
  image: l.image,
  aVerifier: l.confiance === "faible" || !l.propose_par_defaut,
  note: l.notes,
}));

export const CATALOGUE_PAR_REF: ReadonlyMap<string, ProduitCatalogue> = new Map(
  CATALOGUE.map((p) => [p.ref, p]),
);
