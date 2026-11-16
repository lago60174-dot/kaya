import "server-only";
import type { StatutAbonnement } from "@/lib/abonnement/abonnement";
import { supabaseServeur } from "@/lib/supabase/server";

export interface ParametresLus {
  nom: string;
  adresse: string;
  telephone: string;
  mentionLegale: string;
  seuilRemise: number;
  plafondCredit: number;
  stockNegatif: boolean;
  ecartTolere: number;
}

export async function lireParametres(
  boutiqueId: string,
): Promise<ParametresLus | null> {
  const supabase = await supabaseServeur();
  const [b, r] = await Promise.all([
    supabase
      .from("boutiques")
      .select("nom, adresse, telephone, mention_legale")
      .eq("id", boutiqueId)
      .maybeSingle(),
    supabase
      .from("parametres_boutique")
      .select(
        "seuil_remise_vendeur, plafond_credit_defaut, stock_negatif_autorise, ecart_caisse_tolere",
      )
      .eq("boutique_id", boutiqueId)
      .maybeSingle(),
  ]);
  if (!b.data || !r.data) return null;
  return {
    nom: b.data.nom,
    adresse: b.data.adresse ?? "",
    telephone: b.data.telephone ?? "",
    mentionLegale: b.data.mention_legale ?? "",
    seuilRemise: Number(r.data.seuil_remise_vendeur),
    plafondCredit: Number(r.data.plafond_credit_defaut),
    stockNegatif: r.data.stock_negatif_autorise,
    ecartTolere: Number(r.data.ecart_caisse_tolere),
  };
}

export interface AbonnementLu {
  statut: StatutAbonnement;
  planCode: string;
  planEnAttente: string | null;
  prochaineEcheance: string | null;
  finGrace: string | null;
  factures: {
    id: string;
    echeance: string;
    montant: number;
    statut: string;
    payeeLe: string | null;
  }[];
}

/** Abonnement et historique. Seul le montant brut est montré : les frais de paiement ne regardent pas le client. */
export async function lireAbonnement(): Promise<AbonnementLu | null> {
  const supabase = await supabaseServeur();
  const { data: a } = await supabase
    .from("abonnements")
    .select(
      "plan_code, plan_en_attente, statut, prochaine_echeance, fin_grace",
    )
    .maybeSingle();
  if (!a) return null;
  const { data: f } = await supabase
    .from("factures_abonnement")
    .select("id, echeance, montant_brut, statut, payee_le")
    .order("echeance", { ascending: false })
    .limit(12);
  return {
    statut: a.statut as StatutAbonnement,
    planCode: a.plan_code,
    planEnAttente: a.plan_en_attente,
    prochaineEcheance: a.prochaine_echeance,
    finGrace: a.fin_grace,
    factures: (f ?? []).map((x) => ({
      id: x.id,
      echeance: x.echeance,
      montant: Number(x.montant_brut),
      statut: x.statut,
      payeeLe: x.payee_le,
    })),
  };
}
