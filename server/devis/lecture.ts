import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BonLivraisonDetail } from "@/lib/devis/document";
import type {
  BoutiqueDocument,
  DevisDetail,
  PrixActuel,
  StatutDevis,
  TypeDevis,
} from "@/lib/devis/devis";
import type { ProduitVente } from "@/lib/ventes/panier";

const BOUTIQUE =
  "nom, adresse, telephone, mention_legale, logo_cle, ville, email, rccm, niu, signataire, signature_cle, cachet_cle";

interface LigneBoutique {
  nom: string;
  adresse: string | null;
  telephone: string | null;
  mention_legale: string | null;
  logo_cle: string | null;
  ville: string | null;
  email: string | null;
  rccm: string | null;
  niu: string | null;
  signataire: string | null;
  signature_cle: string | null;
  cachet_cle: string | null;
}

const versBoutique = (b: LigneBoutique): BoutiqueDocument => ({
  nom: b.nom,
  adresse: b.adresse,
  telephone: b.telephone,
  mentionLegale: b.mention_legale,
  logoCle: b.logo_cle,
  ville: b.ville,
  email: b.email,
  rccm: b.rccm,
  niu: b.niu,
  signataire: b.signataire,
  signatureCle: b.signature_cle,
  cachetCle: b.cachet_cle,
});

/** Fiche complète d'un devis. La RLS limite au propriétaire de la boutique : un autre compte reçoit null. */
export async function lireDevis(
  supabase: SupabaseClient,
  id: string,
): Promise<DevisDetail | null> {
  const { data: d } = await supabase
    .from("devis")
    .select(
      `id, type, numero, statut, valide_jusqu, sous_total, remise, total, conditions, note, vente_id, envoye_le, cree_le, archive_le, clients(id, nom, telephone), boutiques(${BOUTIQUE})`,
    )
    .eq("id", id)
    .is("archive_le", null)
    .maybeSingle();
  if (!d) return null;
  const [lignes, vente, bon] = await Promise.all([
    supabase
      .from("devis_lignes")
      .select(
        "produit_id, unite_id, nom_produit, nom_unite, quantite, prix_unitaire, total_ligne",
      )
      .eq("devis_id", id)
      .order("ordre")
      .order("id"),
    d.vente_id
      ? supabase
          .from("ventes")
          .select("id, numero_recu")
          .eq("id", d.vente_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("bons_livraison")
      .select("id, numero")
      .eq("devis_id", id)
      .maybeSingle(),
  ]);
  const c = d.clients as unknown as {
    id: string;
    nom: string;
    telephone: string | null;
  } | null;
  return {
    id: d.id,
    type: d.type as TypeDevis,
    numero: d.numero,
    statut: d.statut as StatutDevis,
    date: d.envoye_le ?? d.cree_le,
    valideJusqu: d.valide_jusqu,
    sousTotal: Number(d.sous_total),
    remise: Number(d.remise),
    total: Number(d.total),
    conditions: d.conditions,
    note: d.note,
    client: c,
    boutique: versBoutique(d.boutiques as unknown as LigneBoutique),
    lignes: (lignes.data ?? []).map((l) => ({
      produitId: l.produit_id,
      uniteId: l.unite_id,
      nom: l.nom_produit,
      unite: l.nom_unite,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prix_unitaire),
      total: Number(l.total_ligne),
    })),
    vente: vente.data
      ? { id: vente.data.id, numeroRecu: vente.data.numero_recu }
      : null,
    bonLivraison: bon.data ? { id: bon.data.id, numero: bon.data.numero } : null,
  };
}

/** Prix du jour des unités d'un devis, pour prévenir avant la conversion que le total va changer. */
export async function lirePrixActuels(
  supabase: SupabaseClient,
  uniteIds: string[],
): Promise<Map<string, PrixActuel>> {
  const carte = new Map<string, PrixActuel>();
  if (uniteIds.length === 0) return carte;
  const { data } = await supabase
    .from("produit_unites")
    .select("id, prix_vente, archive_le, produits(actif, archive_le)")
    .in("id", uniteIds);
  for (const u of data ?? []) {
    const p = u.produits as unknown as {
      actif: boolean;
      archive_le: string | null;
    } | null;
    carte.set(u.id, {
      prixVente: Number(u.prix_vente),
      enVente: u.archive_le === null && !!p && p.actif && p.archive_le === null,
    });
  }
  return carte;
}

/**
 * Produits d'un brouillon, avec toutes leurs unités, pour reconstruire le panier à la modification.
 * Un produit qui n'est plus en vente est omis : l'écran prévient alors qu'une ligne a disparu.
 */
export async function lireProduitsDuDevis(
  supabase: SupabaseClient,
  boutiqueId: string,
  produitIds: string[],
): Promise<ProduitVente[]> {
  if (produitIds.length === 0) return [];
  const [{ data: produits }, { data: stocks }] = await Promise.all([
    supabase
      .from("produits")
      .select(
        "id, nom_affiche, unite_base, actif, vignette_cle, categories(nom), produit_unites(id, nom, facteur, prix_vente, archive_le)",
      )
      .in("id", produitIds)
      .is("archive_le", null),
    supabase
      .from("stock_courant")
      .select("produit_id, quantite")
      .eq("boutique_id", boutiqueId)
      .in("produit_id", produitIds),
  ]);
  const stock = new Map((stocks ?? []).map((s) => [s.produit_id, Number(s.quantite)]));
  return (produits ?? [])
    .filter((p) => p.actif)
    .map((p) => {
      const unites = (
        p.produit_unites as unknown as {
          id: string;
          nom: string;
          facteur: number | string;
          prix_vente: number | string;
          archive_le: string | null;
        }[]
      )
        .filter((u) => u.archive_le === null)
        .sort((a, b) => Number(b.facteur) - Number(a.facteur))
        .map((u) => ({
          id: u.id,
          nom: u.nom,
          facteur: Number(u.facteur),
          prixVente: Number(u.prix_vente),
        }));
      return {
        id: p.id,
        nom: p.nom_affiche,
        uniteBase: p.unite_base,
        stock: stock.get(p.id) ?? 0,
        vignette: p.vignette_cle,
        categorie: (p.categories as unknown as { nom: string } | null)?.nom ?? null,
        unites,
      };
    })
    .filter((p) => p.unites.length > 0);
}

export interface LigneListeDevis {
  id: string;
  type: TypeDevis;
  numero: string | null;
  statut: StatutDevis;
  total: number;
  valide_jusqu: string;
  cree_le: string;
  client_nom: string | null;
}

export interface PageDevis {
  devis: LigneListeDevis[];
  suivant: { date: string; id: string } | null;
}

export interface FiltresDevis {
  recherche?: string;
  statut?: StatutDevis;
  type?: TypeDevis;
  apresDate?: string;
  apresId?: string;
}

export async function listerDevis(
  supabase: SupabaseClient,
  boutiqueId: string,
  f: FiltresDevis,
): Promise<PageDevis> {
  const { data, error } = await supabase.rpc("lister_devis", {
    p_boutique: boutiqueId,
    p_recherche: f.recherche ?? null,
    p_statut: f.statut ?? null,
    p_type: f.type ?? null,
    p_limite: 30,
    p_apres_date: f.apresDate ?? null,
    p_apres_id: f.apresId ?? null,
  });
  if (error || !data) return { devis: [], suivant: null };
  const page = data as PageDevis;
  return {
    suivant: page.suivant,
    devis: page.devis.map((d) => ({ ...d, total: Number(d.total) })),
  };
}

export interface LigneBon {
  id: string;
  numero: string;
  date: string;
  adresse_livraison: string | null;
  source: string;
  client: string | null;
}

/** 50 derniers bons de livraison, avec le document d'origine et le client. */
export async function listerBons(
  supabase: SupabaseClient,
  boutiqueId: string,
): Promise<LigneBon[]> {
  const { data: bons } = await supabase
    .from("bons_livraison")
    .select("id, numero, date, adresse_livraison, vente_id, devis_id")
    .eq("boutique_id", boutiqueId)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (!bons || bons.length === 0) return [];
  const venteIds = bons.map((b) => b.vente_id).filter((x): x is string => !!x);
  const devisIds = bons.map((b) => b.devis_id).filter((x): x is string => !!x);
  const [ventes, devis] = await Promise.all([
    venteIds.length
      ? supabase
          .from("ventes")
          .select("id, numero_recu, clients(nom)")
          .in("id", venteIds)
      : Promise.resolve({ data: [] }),
    devisIds.length
      ? supabase.from("devis").select("id, numero, clients(nom)").in("id", devisIds)
      : Promise.resolve({ data: [] }),
  ]);
  const nomClient = (c: unknown) => (c as { nom: string } | null)?.nom ?? null;
  const parVente = new Map(
    (ventes.data ?? []).map((v) => [
      v.id,
      { numero: `Reçu ${v.numero_recu}`, client: nomClient(v.clients) },
    ]),
  );
  const parDevis = new Map(
    (devis.data ?? []).map((d) => [
      d.id,
      { numero: `Devis ${d.numero ?? ""}`.trim(), client: nomClient(d.clients) },
    ]),
  );
  return bons.map((b) => {
    const s = (b.vente_id ? parVente.get(b.vente_id) : parDevis.get(b.devis_id)) ?? {
      numero: "",
      client: null,
    };
    return {
      id: b.id,
      numero: b.numero,
      date: b.date,
      adresse_livraison: b.adresse_livraison,
      source: s.numero,
      client: s.client,
    };
  });
}

/** Bon de livraison complet : les lignes viennent du reçu ou du devis d'origine (jamais modifiables). */
export async function lireBon(
  supabase: SupabaseClient,
  id: string,
): Promise<BonLivraisonDetail | null> {
  const { data: b } = await supabase
    .from("bons_livraison")
    .select("id, numero, date, adresse_livraison, note, vente_id, devis_id")
    .eq("id", id)
    .maybeSingle();
  if (!b) return null;
  if (b.vente_id) {
    const [{ data: v }, { data: l }] = await Promise.all([
      supabase
        .from("ventes")
        .select(`id, numero_recu, clients(nom, telephone), boutiques(${BOUTIQUE})`)
        .eq("id", b.vente_id)
        .maybeSingle(),
      supabase
        .from("vente_lignes")
        .select("nom_produit, nom_unite, quantite")
        .eq("vente_id", b.vente_id)
        .order("ordre")
        .order("id"),
    ]);
    if (!v) return null;
    return {
      id: b.id,
      numero: b.numero,
      date: b.date,
      adresse: b.adresse_livraison,
      note: b.note,
      source: { type: "vente", id: v.id, numero: v.numero_recu },
      client: v.clients as unknown as { nom: string; telephone: string | null } | null,
      boutique: versBoutique(v.boutiques as unknown as LigneBoutique),
      lignes: (l ?? []).map((x) => ({
        nom: x.nom_produit,
        unite: x.nom_unite,
        quantite: Number(x.quantite),
      })),
    };
  }
  const [{ data: d }, { data: l }] = await Promise.all([
    supabase
      .from("devis")
      .select(`id, numero, clients(nom, telephone), boutiques(${BOUTIQUE})`)
      .eq("id", b.devis_id)
      .maybeSingle(),
    supabase
      .from("devis_lignes")
      .select("nom_produit, nom_unite, quantite")
      .eq("devis_id", b.devis_id)
      .order("ordre")
      .order("id"),
  ]);
  if (!d) return null;
  return {
    id: b.id,
    numero: b.numero,
    date: b.date,
    adresse: b.adresse_livraison,
    note: b.note,
    source: { type: "devis", id: d.id, numero: d.numero ?? "" },
    client: d.clients as unknown as { nom: string; telephone: string | null } | null,
    boutique: versBoutique(d.boutiques as unknown as LigneBoutique),
    lignes: (l ?? []).map((x) => ({
      nom: x.nom_produit,
      unite: x.nom_unite,
      quantite: Number(x.quantite),
    })),
  };
}

/** Bon de livraison déjà créé pour une vente (pour afficher « Voir le bon » au lieu d'en proposer un second). */
export async function bonDeLaVente(
  supabase: SupabaseClient,
  venteId: string,
): Promise<{ id: string; numero: string } | null> {
  const { data } = await supabase
    .from("bons_livraison")
    .select("id, numero")
    .eq("vente_id", venteId)
    .maybeSingle();
  return data ?? null;
}
