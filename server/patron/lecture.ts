import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actionsVisibles } from "@/lib/journal/journal";
import { lireLignesConsolidees, type LigneConsolidee } from "@/lib/patron/consolide";

export interface TableauDeBord {
  jour: string;
  ventesTotal: number;
  nbVentes: number;
  ventesHier: number;
  creditAccorde: number;
  especesAttendues: number;
  mtnMomo: number;
  orangeMoney: number;
  depensesTotal: number;
  produitsVendus: {
    produitId: string;
    nom: string;
    quantiteBase: number;
    uniteBase: string;
    montant: number;
  }[];
  stockBas: {
    nombre: number;
    produits: {
      produitId: string;
      nom: string;
      stock: number;
      seuil: number;
      uniteBase: string;
    }[];
  };
  dettes: { total: number; nbClients: number };
  vendeurs: {
    vendeurId: string;
    nom: string;
    nbVentes: number;
    total: number;
  }[];
  cloturesAValider: number;
}

export interface Alerte {
  id: number;
  creeLe: string;
  action: string;
  details: Record<string, unknown>;
  entite: string | null;
  entiteId: string | null;
}

type Brut = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Tout le tableau de bord en un seul appel serveur (réservé au propriétaire, vérifié par la base). */
export async function lireTableauDeBord(
  supabase: SupabaseClient,
  boutiqueId: string,
): Promise<TableauDeBord | null> {
  const { data, error } = await supabase.rpc("tableau_de_bord", {
    p_boutique: boutiqueId,
  });
  if (error || !data) return null;
  const b = data as Brut;
  const c = b.caisse as Brut;
  return {
    jour: String(b.jour),
    ventesTotal: Number(c.ventes_total),
    nbVentes: Number(c.nb_ventes),
    ventesHier: Number(b.ventes_hier),
    creditAccorde: Number(c.credit_accorde),
    especesAttendues: Number(c.especes_attendues),
    mtnMomo: Number(c.mtn_momo) - Number(c.mtn_momo_rembourse),
    orangeMoney: Number(c.orange_money) - Number(c.orange_money_rembourse),
    depensesTotal: Number(c.depenses_total),
    produitsVendus: (b.produits_vendus as Brut[]).map((p) => ({
      produitId: p.produit_id,
      nom: p.nom,
      quantiteBase: Number(p.quantite_base),
      uniteBase: p.unite_base,
      montant: Number(p.montant),
    })),
    stockBas: {
      nombre: Number(b.stock_bas.nombre),
      produits: (b.stock_bas.produits as Brut[]).map((p) => ({
        produitId: p.produit_id,
        nom: p.nom,
        stock: Number(p.stock),
        seuil: Number(p.seuil),
        uniteBase: p.unite_base,
      })),
    },
    dettes: {
      total: Number(b.dettes.total),
      nbClients: Number(b.dettes.nb_clients),
    },
    vendeurs: (b.vendeurs as Brut[]).map((v) => ({
      vendeurId: v.vendeur_id,
      nom: v.nom,
      nbVentes: Number(v.nb_ventes),
      total: Number(v.total),
    })),
    cloturesAValider: Number(b.clotures_a_valider),
  };
}

/** Dernières alertes, selon le journal permis par le plan. */
export async function lireAlertesRecentes(
  supabase: SupabaseClient,
  boutiqueId: string,
  complet: boolean,
  limite = 5,
): Promise<Alerte[]> {
  const { data } = await supabase.rpc("lister_journal", {
    p_boutique: boutiqueId,
    p_actions: actionsVisibles(complet),
    p_alertes: true,
    p_limite: limite,
  });
  return ((data?.entrees ?? []) as Brut[]).map((e) => ({
    id: Number(e.id),
    creeLe: e.cree_le,
    action: e.action,
    details: e.details ?? {},
    entite: e.entite,
    entiteId: e.entite_id,
  }));
}

/** Boutiques que l'utilisateur peut consulter (la RLS décide). */
export async function listerBoutiques(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("boutiques")
    .select("id, nom")
    .order("nom");
  return (data ?? []) as { id: string; nom: string }[];
}

/** Vue d'ensemble : une ligne par boutique, calculée en un seul appel. Réservée au propriétaire (la base le vérifie). */
export async function lireTableauConsolide(
  supabase: SupabaseClient,
): Promise<LigneConsolidee[] | null> {
  const { data, error } = await supabase.rpc("tableau_de_bord_consolide");
  if (error || !data) return null;
  return lireLignesConsolidees((data as { boutiques?: unknown }).boutiques);
}
