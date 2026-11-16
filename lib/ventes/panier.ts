export interface UniteVente {
  id: string;
  nom: string;
  facteur: number;
  prixVente: number;
}

export interface ProduitVente {
  id: string;
  nom: string;
  uniteBase: string;
  stock: number;
  unites: UniteVente[];
  /** Clé de la vignette et nom de la catégorie, pour l'affichage seulement. */
  vignette?: string | null;
  categorie?: string | null;
}

export interface LignePanier {
  cle: string;
  produit: ProduitVente;
  uniteId: string;
  quantite: number;
  remiseLigne: number;
}

/** Prix d'une ligne, arrondi au FCFA comme la base (round half up), en entiers pour éviter tout flottant. */
export function arrondirProduit(quantite: number, prix: number): number {
  const milliemes = BigInt(Math.round(quantite * 1000));
  return Number((milliemes * BigInt(prix) + BigInt(500)) / BigInt(1000));
}

export function uniteDeLigne(l: LignePanier): UniteVente {
  return (
    l.produit.unites.find((u) => u.id === l.uniteId) ?? l.produit.unites[0]
  );
}

export const brutLigne = (l: LignePanier) =>
  arrondirProduit(l.quantite, uniteDeLigne(l).prixVente);
export const totalLigne = (l: LignePanier) =>
  Math.max(0, brutLigne(l) - l.remiseLigne);

export interface Totaux {
  brut: number;
  remiseLignes: number;
  remise: number;
  total: number;
  pourcentageRemise: number;
}

/** Aperçu affiché au vendeur. Le serveur recalcule tout à la validation : seul son résultat fait foi. */
export function calculerTotaux(
  lignes: LignePanier[],
  remiseGlobale: number,
): Totaux {
  const brut = lignes.reduce((s, l) => s + brutLigne(l), 0);
  const remiseLignes = lignes.reduce((s, l) => s + l.remiseLigne, 0);
  const remise = remiseLignes + remiseGlobale;
  return {
    brut,
    remiseLignes,
    remise,
    total: brut - remise,
    pourcentageRemise: brut > 0 ? (remise * 100) / brut : 0,
  };
}

/** Un tap sur le même produit et la même unité ajoute 1 à la quantité. */
export function ajouterAuPanier(
  lignes: LignePanier[],
  produit: ProduitVente,
  uniteId: string,
  nouvelleCle: () => string,
): LignePanier[] {
  const existante = lignes.find(
    (l) => l.produit.id === produit.id && l.uniteId === uniteId,
  );
  if (!existante)
    return [
      ...lignes,
      { cle: nouvelleCle(), produit, uniteId, quantite: 1, remiseLigne: 0 },
    ];
  return lignes.map((l) =>
    l === existante
      ? { ...l, quantite: Math.round((l.quantite + 1) * 1000) / 1000 }
      : l,
  );
}

export const retirerDuPanier = (lignes: LignePanier[], cle: string) =>
  lignes.filter((l) => l.cle !== cle);

export const changerQuantite = (
  lignes: LignePanier[],
  cle: string,
  quantite: number,
) => lignes.map((l) => (l.cle === cle ? { ...l, quantite } : l));

export const changerUnite = (
  lignes: LignePanier[],
  cle: string,
  uniteId: string,
) => lignes.map((l) => (l.cle === cle ? { ...l, uniteId, remiseLigne: 0 } : l));

/** Quantité demandée par produit, en unité de base (un produit peut apparaître dans plusieurs unités). */
export function demandeParProduit(lignes: LignePanier[]): Map<string, number> {
  const demande = new Map<string, number>();
  for (const l of lignes) {
    const base = Math.round(l.quantite * uniteDeLigne(l).facteur * 1000) / 1000;
    demande.set(
      l.produit.id,
      Math.round(((demande.get(l.produit.id) ?? 0) + base) * 1000) / 1000,
    );
  }
  return demande;
}

export interface Rupture {
  produitId: string;
  nom: string;
  demande: number;
  stock: number;
  uniteBase: string;
}

/** Produits dont la demande dépasse le stock connu. Simple avertissement : la base tranche (stock négatif autorisé ou non). */
export function lignesEnRupture(lignes: LignePanier[]): Rupture[] {
  const demande = demandeParProduit(lignes);
  const vus = new Set<string>();
  const ruptures: Rupture[] = [];
  for (const l of lignes) {
    if (vus.has(l.produit.id)) continue;
    vus.add(l.produit.id);
    const d = demande.get(l.produit.id) ?? 0;
    if (d > l.produit.stock)
      ruptures.push({
        produitId: l.produit.id,
        nom: l.produit.nom,
        demande: d,
        stock: l.produit.stock,
        uniteBase: l.produit.uniteBase,
      });
  }
  return ruptures;
}

export type VerificationRemise = { ok: true } | { ok: false; message: string };

/** Même règle qu'en base : le vendeur est limité au seuil du propriétaire, le propriétaire ne l'est pas. */
export function remiseAutorisee(
  role: "proprietaire" | "vendeur",
  seuilPourcent: number,
  totaux: Totaux,
): VerificationRemise {
  if (totaux.remise < 0)
    return { ok: false, message: "La remise ne peut pas être négative." };
  if (totaux.brut > 0 && totaux.total <= 0)
    return {
      ok: false,
      message:
        "La remise ne peut pas couvrir tout le prix : le total doit rester supérieur à zéro.",
    };
  if (role === "vendeur" && totaux.pourcentageRemise > seuilPourcent) {
    return {
      ok: false,
      message: `Remise trop élevée : le maximum pour un vendeur est de ${seuilPourcent} %. Demandez au propriétaire.`,
    };
  }
  return { ok: true };
}
