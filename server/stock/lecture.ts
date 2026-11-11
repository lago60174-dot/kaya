import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UniteProduit {
  id: string;
  nom: string;
  facteur: number;
  prix_vente: number;
}

export interface ProduitDetail {
  id: string;
  nom: string;
  nom_affiche: string;
  unite_base: string;
  seuil_alerte: number;
  actif: boolean;
  image_cle: string | null;
  vignette_cle: string | null;
  code_barres: string | null;
  categorie_id: string | null;
  marque_id: string | null;
  categories: { nom: string } | null;
  marques: { nom: string } | null;
  unites: UniteProduit[];
  /** Visible uniquement par le propriétaire (la RLS renvoie rien au vendeur). */
  prix_achat: number | null;
  stock: number;
}

/** Fiche complète d'un produit. Le prix d'achat n'est renvoyé qu'au propriétaire, par la RLS. */
export async function lireProduit(
  supabase: SupabaseClient,
  id: string,
  boutiqueId: string,
): Promise<ProduitDetail | null> {
  const { data } = await supabase
    .from("produits")
    .select(
      "id, nom, nom_affiche, unite_base, seuil_alerte, actif, image_cle, vignette_cle, code_barres, categorie_id, marque_id, categories(nom), marques(nom), produit_unites(id, nom, facteur, prix_vente, archive_le), produit_couts(prix_achat)",
    )
    .eq("id", id)
    .is("archive_le", null)
    .maybeSingle();
  if (!data) return null;
  const { data: stock } = await supabase
    .from("stock_courant")
    .select("quantite")
    .eq("produit_id", id)
    .eq("boutique_id", boutiqueId)
    .maybeSingle();
  const brut = data as unknown as ProduitDetail & {
    produit_unites: (UniteProduit & { archive_le: string | null })[];
    produit_couts: { prix_achat: number } | null;
  };
  return {
    ...brut,
    seuil_alerte: Number(brut.seuil_alerte),
    unites: brut.produit_unites
      .filter((u) => u.archive_le === null)
      .map((u) => ({
        id: u.id,
        nom: u.nom,
        facteur: Number(u.facteur),
        prix_vente: Number(u.prix_vente),
      }))
      .sort((a, b) => b.facteur - a.facteur || a.nom.localeCompare(b.nom)),
    prix_achat: brut.produit_couts
      ? Number(brut.produit_couts.prix_achat)
      : null,
    stock: stock ? Number(stock.quantite) : 0,
  };
}

export interface LigneListe {
  id: string;
  nom_affiche: string;
  categorie_nom: string | null;
  marque_nom: string | null;
  unite_base: string;
  stock: number;
  stock_bas: boolean;
  actif: boolean;
  vignette_cle: string | null;
  unites: { id: string; nom: string; facteur: number; prix_vente: number }[];
}

export interface PageListe {
  produits: LigneListe[];
  suivant: { nom: string; id: string } | null;
}

export interface Filtres {
  recherche?: string;
  categorie?: string;
  marque?: string;
  stockBas?: boolean;
  apresNom?: string;
  apresId?: string;
}

export async function listerProduits(
  supabase: SupabaseClient,
  boutiqueId: string,
  f: Filtres,
): Promise<PageListe> {
  const { data, error } = await supabase.rpc("lister_produits", {
    p_boutique: boutiqueId,
    p_recherche: f.recherche ?? null,
    p_categorie: f.categorie ?? null,
    p_stock_bas: f.stockBas ?? false,
    p_limite: 30,
    p_apres_nom: f.apresNom ?? null,
    p_apres_id: f.apresId ?? null,
    p_marque: f.marque ?? null,
  });
  if (error || !data) return { produits: [], suivant: null };
  return data as PageListe;
}
