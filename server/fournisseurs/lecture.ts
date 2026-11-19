import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LigneCommandeDetail, StatutCommande } from "@/lib/fournisseurs/fournisseurs";

export interface FournisseurListe {
  id: string;
  nom: string;
  telephone: string | null;
  du: number;
}

export async function listerFournisseurs(supabase: SupabaseClient, boutiqueId: string): Promise<FournisseurListe[]> {
  const { data } = await supabase.rpc("lister_fournisseurs", { p_boutique: boutiqueId });
  return ((data ?? []) as FournisseurListe[]).map((f) => ({ ...f, du: Number(f.du) }));
}

export async function lireFournisseur(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("fournisseurs")
    .select("id, nom, telephone, adresse, notes")
    .eq("id", id)
    .is("archive_le", null)
    .maybeSingle();
  return data;
}

export interface LigneCommandeListe {
  id: string;
  numero: string;
  statut: StatutCommande;
  total: number;
  cree_le: string;
  fournisseur_nom: string;
}

export async function listerCommandes(
  supabase: SupabaseClient,
  boutiqueId: string,
  o: { statut?: string; apresDate?: string; apresId?: string },
) {
  const { data } = await supabase.rpc("lister_commandes", {
    p_boutique: boutiqueId,
    p_statut: o.statut ?? null,
    p_limite: 30,
    p_apres_date: o.apresDate ?? null,
    p_apres_id: o.apresId ?? null,
  });
  const page = (data ?? { commandes: [], suivant: null }) as {
    commandes: LigneCommandeListe[];
    suivant: { date: string; id: string } | null;
  };
  return { commandes: page.commandes.map((c) => ({ ...c, total: Number(c.total) })), suivant: page.suivant };
}

export interface CommandeDetail {
  id: string;
  numero: string;
  statut: StatutCommande;
  total: number;
  note: string | null;
  motifAnnulation: string | null;
  date: string;
  fournisseur: { id: string; nom: string; telephone: string | null };
  boutiqueNom: string;
  lignes: LigneCommandeDetail[];
  receptions: { id: string; date: string; montant: number }[];
}

export async function lireCommande(supabase: SupabaseClient, id: string): Promise<CommandeDetail | null> {
  const { data: c } = await supabase
    .from("commandes_fournisseurs")
    .select("id, numero, statut, total, note, motif_annulation, cree_le, fournisseurs(id, nom, telephone), boutiques(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const [lignes, receptions] = await Promise.all([
    supabase
      .from("commande_lignes")
      .select("id, produit_id, nom_produit, nom_unite, facteur, quantite, quantite_recue, prix_achat")
      .eq("commande_id", id)
      .order("ordre")
      .order("id"),
    supabase.from("receptions").select("id, date, montant").eq("commande_id", id).order("date"),
  ]);
  return {
    id: c.id,
    numero: c.numero,
    statut: c.statut as StatutCommande,
    total: Number(c.total),
    note: c.note,
    motifAnnulation: c.motif_annulation,
    date: c.cree_le,
    fournisseur: c.fournisseurs as unknown as CommandeDetail["fournisseur"],
    boutiqueNom: (c.boutiques as unknown as { nom: string }).nom,
    lignes: (lignes.data ?? []).map((l) => ({
      id: l.id,
      produitId: l.produit_id,
      nom: l.nom_produit,
      unite: l.nom_unite,
      facteur: Number(l.facteur),
      quantite: Number(l.quantite),
      recue: Number(l.quantite_recue),
      prixAchat: Number(l.prix_achat),
    })),
    receptions: (receptions.data ?? []).map((r) => ({ id: r.id, date: r.date, montant: Number(r.montant) })),
  };
}

export interface DetteListe {
  id: string;
  montant: number;
  paye: number;
  solde: number;
  cree_le: string;
  fournisseur_id: string;
  fournisseur_nom: string;
  commande_id: string;
  commande_numero: string;
}

/** Dettes encore ouvertes, les plus anciennes d'abord (50 maximum), éventuellement d'un seul fournisseur. */
export async function listerDettes(
  supabase: SupabaseClient,
  boutiqueId: string,
  fournisseurId?: string,
): Promise<DetteListe[]> {
  let q = supabase
    .from("dettes_fournisseurs")
    .select("id, montant, paye, solde, cree_le, fournisseur_id, commande_id, fournisseurs(nom), commandes_fournisseurs(numero)")
    .eq("boutique_id", boutiqueId)
    .eq("statut", "ouverte")
    .order("cree_le")
    .limit(50);
  if (fournisseurId) q = q.eq("fournisseur_id", fournisseurId);
  const { data } = await q;
  return (data ?? []).map((d) => ({
    id: d.id,
    montant: Number(d.montant),
    paye: Number(d.paye),
    solde: Number(d.solde),
    cree_le: d.cree_le,
    fournisseur_id: d.fournisseur_id,
    fournisseur_nom: (d.fournisseurs as unknown as { nom: string }).nom,
    commande_id: d.commande_id,
    commande_numero: (d.commandes_fournisseurs as unknown as { numero: string }).numero,
  }));
}

export interface ChangementPrixAchat {
  id: string;
  date: string;
  produit: string;
  fournisseur: string | null;
  ancien: number | null;
  nouveau: number;
  uniteBase: string;
}

/** Derniers changements de prix d'achat (par unité de base), pour repérer les hausses. */
export async function listerChangementsPrix(supabase: SupabaseClient, produitId?: string): Promise<ChangementPrixAchat[]> {
  let q = supabase
    .from("prix_achat_historique")
    .select("id, date, prix_achat, ancien_prix, produits(nom_affiche, unite_base), fournisseurs(nom)")
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (produitId) q = q.eq("produit_id", produitId);
  const { data } = await q;
  return (data ?? []).map((h) => {
    const p = h.produits as unknown as { nom_affiche: string; unite_base: string };
    return {
      id: h.id,
      date: h.date,
      produit: p.nom_affiche,
      fournisseur: (h.fournisseurs as unknown as { nom: string } | null)?.nom ?? null,
      ancien: h.ancien_prix === null ? null : Number(h.ancien_prix),
      nouveau: Number(h.prix_achat),
      uniteBase: p.unite_base,
    };
  });
}
