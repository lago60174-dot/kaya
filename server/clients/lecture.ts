import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreanceOuverte } from "@/lib/clients/credit";
import type { PaiementRecu } from "@/lib/clients/messages";

export interface LigneClient {
  id: string;
  nom: string;
  telephone: string | null;
  plafond_credit: number | null;
  notes: string | null;
  dette: number;
}

export async function listerClients(
  supabase: SupabaseClient,
  boutiqueId: string,
  f: { recherche?: string; apresNom?: string; apresId?: string },
): Promise<{
  clients: LigneClient[];
  suivant: { nom: string; id: string } | null;
}> {
  const { data, error } = await supabase.rpc("lister_clients", {
    p_boutique: boutiqueId,
    p_recherche: f.recherche ?? null,
    p_limite: 30,
    p_apres_nom: f.apresNom ?? null,
    p_apres_id: f.apresId ?? null,
  });
  if (error || !data) return { clients: [], suivant: null };
  const page = data as {
    clients: LigneClient[];
    suivant: { nom: string; id: string } | null;
  };
  return {
    suivant: page.suivant,
    clients: page.clients.map((c) => ({
      ...c,
      dette: Number(c.dette),
      plafond_credit:
        c.plafond_credit === null ? null : Number(c.plafond_credit),
    })),
  };
}

export interface LigneDette {
  client_id: string;
  nom: string;
  telephone: string | null;
  dette: number;
  plus_ancienne: string;
  nb_ventes: number;
}

export async function listerDettes(
  supabase: SupabaseClient,
  boutiqueId: string,
  tri: "montant" | "anciennete",
  decalage: number,
): Promise<{
  clients: LigneDette[];
  totalDettes: number;
  totalClients: number;
}> {
  const { data, error } = await supabase.rpc("lister_dettes", {
    p_boutique: boutiqueId,
    p_tri: tri,
    p_limite: 30,
    p_decalage: decalage,
  });
  if (error || !data) return { clients: [], totalDettes: 0, totalClients: 0 };
  const r = data as {
    clients: LigneDette[];
    total_dettes: number;
    total_clients: number;
  };
  return {
    totalDettes: Number(r.total_dettes),
    totalClients: Number(r.total_clients),
    clients: r.clients.map((c) => ({
      ...c,
      dette: Number(c.dette),
      nb_ventes: Number(c.nb_ventes),
    })),
  };
}

export interface FicheClient {
  client: {
    id: string;
    nom: string;
    telephone: string | null;
    notes: string | null;
    plafondCredit: number | null;
  };
  plafondParDefaut: number;
  boutiqueNom: string;
  dette: number;
  creances: CreanceOuverte[];
  achats: {
    id: string;
    numeroRecu: string;
    date: string;
    total: number;
    annule: boolean;
  }[];
  paiements: { numero: string; date: string; montant: number; mode: string }[];
}

/** Fiche complète d'un client dans la boutique : dettes en cours, achats, paiements. Tout passe par la RLS. */
export async function lireFicheClient(
  supabase: SupabaseClient,
  clientId: string,
  boutiqueId: string,
): Promise<FicheClient | null> {
  const { data: c } = await supabase
    .from("clients")
    .select("id, nom, telephone, notes, plafond_credit")
    .eq("id", clientId)
    .is("archive_le", null)
    .maybeSingle();
  if (!c) return null;
  const [params, boutique, creances, achats, paiements] = await Promise.all([
    supabase
      .from("parametres_boutique")
      .select("plafond_credit_defaut")
      .eq("boutique_id", boutiqueId)
      .maybeSingle(),
    supabase.from("boutiques").select("nom").eq("id", boutiqueId).maybeSingle(),
    supabase
      .from("creances")
      .select("id, solde, ventes(numero_recu, date)")
      .eq("client_id", clientId)
      .eq("boutique_id", boutiqueId)
      .eq("statut", "ouverte"),
    supabase
      .from("ventes")
      .select("id, numero_recu, date, total, statut")
      .eq("client_id", clientId)
      .eq("boutique_id", boutiqueId)
      .order("date", { ascending: false })
      .limit(20),
    supabase
      .from("paiements")
      .select("numero_recu, date, montant, mode")
      .eq("client_id", clientId)
      .eq("boutique_id", boutiqueId)
      .eq("type", "remboursement_credit")
      .order("date", { ascending: false })
      .limit(60),
  ]);
  const ouvertes: CreanceOuverte[] = (creances.data ?? []).map((r) => {
    const v = r.ventes as unknown as { numero_recu: string; date: string };
    return {
      id: r.id,
      numeroRecu: v.numero_recu,
      date: v.date,
      solde: Number(r.solde),
    };
  });
  // Un paiement réparti sur plusieurs ventes a plusieurs lignes et un seul numéro : on regroupe.
  const parNumero = new Map<
    string,
    { numero: string; date: string; montant: number; mode: string }
  >();
  for (const p of paiements.data ?? []) {
    const e = parNumero.get(p.numero_recu) ?? {
      numero: p.numero_recu,
      date: p.date,
      montant: 0,
      mode: p.mode,
    };
    e.montant += Number(p.montant);
    parNumero.set(p.numero_recu, e);
  }
  return {
    client: {
      id: c.id,
      nom: c.nom,
      telephone: c.telephone,
      notes: c.notes,
      plafondCredit:
        c.plafond_credit === null ? null : Number(c.plafond_credit),
    },
    plafondParDefaut: Number(params.data?.plafond_credit_defaut ?? 0),
    boutiqueNom: boutique.data?.nom ?? "",
    dette: ouvertes.reduce((s, x) => s + x.solde, 0),
    creances: ouvertes.sort((a, b) => a.date.localeCompare(b.date)),
    achats: (achats.data ?? []).map((v) => ({
      id: v.id,
      numeroRecu: v.numero_recu,
      date: v.date,
      total: Number(v.total),
      annule: v.statut === "annulee",
    })),
    paiements: [...parNumero.values()].slice(0, 20),
  };
}

export interface PaiementCreditDetail extends PaiementRecu {
  clientId: string;
  clientTelephone: string | null;
  boutique: string;
  boutiqueAdresse: string | null;
  boutiqueTelephone: string | null;
  mentionLegale: string | null;
  logoCle: string | null;
  boutiqueVille: string | null;
  boutiqueEmail: string | null;
  rccm: string | null;
  niu: string | null;
  signataire: string | null;
  signatureCle: string | null;
  cachetCle: string | null;
}

/** Reçu d'un paiement de crédit : un numéro, éventuellement plusieurs ventes soldées ou entamées. */
export async function lirePaiementCredit(
  supabase: SupabaseClient,
  clientId: string,
  boutiqueId: string,
  numero: string,
): Promise<PaiementCreditDetail | null> {
  const { data: lignes } = await supabase
    .from("paiements")
    .select("montant, mode, date, ventes(numero_recu, date), creances(solde)")
    .eq("client_id", clientId)
    .eq("boutique_id", boutiqueId)
    .eq("numero_recu", numero)
    .eq("type", "remboursement_credit");
  if (!lignes || lignes.length === 0) return null;
  const [client, boutique, ouvertes] = await Promise.all([
    supabase
      .from("clients")
      .select("nom, telephone")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("boutiques")
      .select(
        "nom, adresse, telephone, mention_legale, logo_cle, ville, email, rccm, niu, signataire, signature_cle, cachet_cle",
      )
      .eq("id", boutiqueId)
      .maybeSingle(),
    supabase
      .from("creances")
      .select("solde")
      .eq("client_id", clientId)
      .eq("boutique_id", boutiqueId)
      .eq("statut", "ouverte"),
  ]);
  const triees = [...lignes].sort((a, b) =>
    (a.ventes as unknown as { date: string }).date.localeCompare(
      (b.ventes as unknown as { date: string }).date,
    ),
  );
  return {
    clientId,
    clientTelephone: client.data?.telephone ?? null,
    boutique: boutique.data?.nom ?? "",
    boutiqueAdresse: boutique.data?.adresse ?? null,
    boutiqueTelephone: boutique.data?.telephone ?? null,
    mentionLegale: boutique.data?.mention_legale ?? null,
    logoCle: boutique.data?.logo_cle ?? null,
    boutiqueVille: boutique.data?.ville ?? null,
    boutiqueEmail: boutique.data?.email ?? null,
    rccm: boutique.data?.rccm ?? null,
    niu: boutique.data?.niu ?? null,
    signataire: boutique.data?.signataire ?? null,
    signatureCle: boutique.data?.signature_cle ?? null,
    cachetCle: boutique.data?.cachet_cle ?? null,
    numero,
    date: lignes[0].date,
    client: client.data?.nom ?? "",
    montant: lignes.reduce((s, l) => s + Number(l.montant), 0),
    mode: lignes[0].mode,
    repartition: triees.map((l) => ({
      numeroRecuVente: (l.ventes as unknown as { numero_recu: string })
        .numero_recu,
      montant: Number(l.montant),
      soldeApres: Number((l.creances as unknown as { solde: number }).solde),
    })),
    detteRestante: (ouvertes.data ?? []).reduce(
      (s, r) => s + Number(r.solde),
      0,
    ),
  };
}
