import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Brut = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ResumeAdmin {
  boutiques: number;
  inscrites7j: number;
  inscrites30j: number;
  statuts: Record<string, number>;
  plans: Record<string, number>;
  revenuMensuelEstime: number;
  encaisse30j: number;
  aEncaisser: number;
  actives7j: number;
  ventes7j: number;
  demandesPartenaire: number;
  paiementsARevoir: number;
}

export async function lireResume(db: SupabaseClient): Promise<ResumeAdmin | null> {
  const { data, error } = await db.rpc("admin_resume");
  if (error || !data) return null;
  const b = data as Brut;
  return {
    boutiques: Number(b.boutiques),
    inscrites7j: Number(b.inscrites_7j),
    inscrites30j: Number(b.inscrites_30j),
    statuts: b.statuts as Record<string, number>,
    plans: b.plans as Record<string, number>,
    revenuMensuelEstime: Number(b.revenu_mensuel_estime),
    encaisse30j: Number(b.encaisse_30j),
    aEncaisser: Number(b.a_encaisser),
    actives7j: Number(b.actives_7j),
    ventes7j: Number(b.ventes_7j),
    demandesPartenaire: Number(b.demandes_partenaire),
    paiementsARevoir: Number(b.paiements_a_revoir),
  };
}

export interface LigneBoutique {
  id: string;
  nom: string;
  boutique: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  plan: string;
  statut: string;
  prochaineEcheance: string | null;
  creeLe: string;
  ventes30j: number;
  derniereVente: string | null;
}

export async function listerBoutiques(
  db: SupabaseClient,
  filtres: { recherche?: string; statut?: string; plan?: string },
): Promise<LigneBoutique[] | null> {
  const { data, error } = await db.rpc("admin_boutiques", {
    p_recherche: filtres.recherche ?? null,
    p_statut: filtres.statut ?? null,
    p_plan: filtres.plan ?? null,
  });
  if (error || !Array.isArray(data)) return null;
  return (data as Brut[]).map((b) => ({
    id: b.id,
    nom: b.nom,
    boutique: b.boutique ?? null,
    ville: b.ville ?? null,
    telephone: b.telephone ?? null,
    email: b.email ?? null,
    plan: b.plan,
    statut: b.statut,
    prochaineEcheance: b.prochaine_echeance ?? null,
    creeLe: b.cree_le,
    ventes30j: Number(b.ventes_30j),
    derniereVente: b.derniere_vente ?? null,
  }));
}

export interface FicheBoutique {
  id: string;
  nom: string;
  creeLe: string;
  plan: string;
  boutique: { nom: string | null; ville: string | null; telephone: string | null; emailBoutique: string | null } | null;
  proprietaire: { nom: string | null; email: string | null } | null;
  abonnement: {
    statut: string;
    plan: string;
    planEnAttente: string | null;
    prochaineEcheance: string | null;
    finGrace: string | null;
  } | null;
  vendeurs: number;
  produits: number;
  clients: number;
  ventes30j: { nb: number; total: number };
  derniereVente: string | null;
  parrain: { nom: string; code: string } | null;
  factures: {
    id: string;
    type: string;
    montantBrut: number;
    fraisPaiement: number;
    statut: string;
    mode: string;
    echeance: string | null;
    payeeLe: string | null;
    moisCouverts: number;
    planCode: string | null;
    note: string | null;
    creeLe: string;
  }[];
  journal: { action: string; details: Record<string, unknown>; creeLe: string }[];
}

export async function lireFiche(db: SupabaseClient, id: string): Promise<FicheBoutique | null> {
  const { data, error } = await db.rpc("admin_boutique", { p_org: id });
  if (error || !data) return null;
  const b = data as Brut;
  return {
    id: b.id,
    nom: b.nom,
    creeLe: b.cree_le,
    plan: b.plan,
    boutique: b.boutique
      ? {
          nom: b.boutique.nom ?? null,
          ville: b.boutique.ville ?? null,
          telephone: b.boutique.telephone ?? null,
          emailBoutique: b.boutique.email_boutique ?? null,
        }
      : null,
    proprietaire: b.proprietaire ? { nom: b.proprietaire.nom ?? null, email: b.proprietaire.email ?? null } : null,
    abonnement: b.abonnement
      ? {
          statut: b.abonnement.statut,
          plan: b.abonnement.plan,
          planEnAttente: b.abonnement.plan_en_attente ?? null,
          prochaineEcheance: b.abonnement.prochaine_echeance ?? null,
          finGrace: b.abonnement.fin_grace ?? null,
        }
      : null,
    vendeurs: Number(b.vendeurs),
    produits: Number(b.produits),
    clients: Number(b.clients),
    ventes30j: { nb: Number(b.ventes_30j?.nb ?? 0), total: Number(b.ventes_30j?.total ?? 0) },
    derniereVente: b.derniere_vente ?? null,
    parrain: b.parrain ?? null,
    factures: (b.factures as Brut[]).map((f) => ({
      id: f.id,
      type: f.type,
      montantBrut: Number(f.montant_brut),
      fraisPaiement: Number(f.frais_paiement),
      statut: f.statut,
      mode: f.mode,
      echeance: f.echeance ?? null,
      payeeLe: f.payee_le ?? null,
      moisCouverts: Number(f.mois_couverts),
      planCode: f.plan_code ?? null,
      note: f.note ?? null,
      creeLe: f.cree_le,
    })),
    journal: (b.journal as Brut[]).map((j) => ({ action: j.action, details: j.details ?? {}, creeLe: j.cree_le })),
  };
}
