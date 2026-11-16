import type { SupabaseClient } from "@supabase/supabase-js";
import { lienFacture } from "@/lib/abonnement/etat";
import {
  creerLienPaiement,
  expirerLien,
  fraisPaiement,
  lireStatutPaiement,
  type ConfigFapshi,
  type Fetch,
} from "@/lib/fapshi/client";
import type { NotificationFapshi } from "@/lib/fapshi/webhook";
import { envoyerModele, type ConfigZernio } from "@/lib/zernio/client";
import {
  LANGUE_MODELES,
  MODELES,
  telephoneInternational,
  variablesRelance,
  type EtapeRelance,
} from "@/lib/zernio/modeles";

/**
 * Logique des abonnements, indépendante de Next : la base (service_role) et les clients sont passés en paramètres,
 * ce qui permet de la tester avec de faux services. Les règles d'argent sont dans les fonctions SQL ;
 * ce code ne fait que parler à Fapshi / Zernio et appeler ces fonctions.
 */
export interface Services {
  db: SupabaseClient;
  fapshi: ConfigFapshi | null;
  zernio: ConfigZernio | null;
  urlApp: string;
  http?: Fetch;
}

export type ResultatConfirmation =
  | { type: "confirme" | "deja_traite" | "deja_payee" }
  | {
      type: "a_verifier";
      raison:
        | "facture_inconnue"
        | "facture_annulee"
        | "montant_incorrect"
        | "incoherent";
    }
  | { type: "non_paye"; statut: string };

interface LigneFacture {
  id: string;
  montant_brut: number | string;
  statut: string;
}

/**
 * Confirme une facture après avoir relu son état chez Fapshi (le webhook seul n'est jamais cru).
 * Idempotent : la base ignore un évènement déjà traité.
 */
export async function confirmerPaiement(
  s: Services,
  transId: string,
  factureId: string,
): Promise<ResultatConfirmation> {
  if (!s.fapshi) throw new Error("Fapshi n'est pas configuré.");
  const statut = await lireStatutPaiement(s.fapshi, transId, s.http);
  if (statut.externalId && statut.externalId !== factureId)
    return { type: "a_verifier", raison: "incoherent" };
  if (statut.status !== "SUCCESSFUL")
    return { type: "non_paye", statut: statut.status };
  const { data: facture } = await s.db
    .from("factures_abonnement")
    .select("id, montant_brut, statut")
    .eq("id", factureId)
    .maybeSingle<LigneFacture>();
  // Montant : celui annoncé par Fapshi s'il est fourni, sinon celui de notre facture (le lien a été créé pour ce montant).
  const montant = statut.amount ?? Number(facture?.montant_brut ?? 0);
  const { data, error } = await s.db.rpc("confirmer_paiement_abonnement", {
    p_evenement_id: `${transId}:SUCCESSFUL`,
    p_facture_id: factureId,
    p_montant: montant,
    p_frais: fraisPaiement(montant, statut.revenue),
    p_contenu: { transId, status: statut.status, externalId: factureId },
    p_trans_id: transId,
  });
  if (error) throw new Error("Confirmation impossible.");
  const r = String(data);
  if (r === "confirme" || r === "deja_traite" || r === "deja_payee")
    return { type: r };
  return {
    type: "a_verifier",
    raison: r as "facture_inconnue" | "facture_annulee" | "montant_incorrect",
  };
}

/** Webhook Fapshi : succès -> confirmation ; échec ou expiration -> le lien est libéré pour en générer un nouveau. */
export async function traiterNotification(
  s: Services,
  n: NotificationFapshi,
): Promise<ResultatConfirmation | { type: "ignore" }> {
  if (!n.externalId) return { type: "ignore" };
  if (n.status === "SUCCESSFUL")
    return confirmerPaiement(s, n.transId, n.externalId);
  if (n.status === "FAILED" || n.status === "EXPIRED") {
    await s.db.from("evenements_paiement").upsert(
      {
        fournisseur: "fapshi",
        evenement_id: `${n.transId}:${n.status}`,
        contenu: { transId: n.transId, status: n.status },
        statut_traitement: "ignore",
      },
      { onConflict: "fournisseur,evenement_id", ignoreDuplicates: true },
    );
    await s.db
      .from("factures_abonnement")
      .update({ lien_paiement: null, lien_expire_le: null })
      .eq("id", n.externalId)
      .eq("trans_id", n.transId)
      .eq("statut", "a_payer");
  }
  return { type: "ignore" };
}

export type ResultatLien =
  | { type: "lien"; url: string }
  | { type: "payee" | "annulee" | "indisponible" | "introuvable" };

const UNE_HEURE = 3_600_000;

/**
 * Lien de paiement d'une facture. Le lien Fapshi expire en 24 h : on réutilise l'actuel s'il vaut encore plus d'une heure,
 * sinon on en crée un nouveau (et on invalide l'ancien).
 */
export async function lienPourFacture(
  s: Services,
  factureId: string,
  maintenant = new Date(),
): Promise<ResultatLien> {
  const { data: f } = await s.db
    .from("factures_abonnement")
    .select(
      "id, organisation_id, type, montant_brut, statut, lien_paiement, trans_id, lien_expire_le, plan_code",
    )
    .eq("id", factureId)
    .maybeSingle();
  if (!f) return { type: "introuvable" };
  if (f.statut === "payee") return { type: "payee" };
  if (f.statut === "annulee") return { type: "annulee" };
  if (!s.fapshi) return { type: "indisponible" };
  if (
    f.lien_paiement &&
    f.lien_expire_le &&
    new Date(f.lien_expire_le).getTime() - maintenant.getTime() > UNE_HEURE
  )
    return { type: "lien", url: f.lien_paiement };
  const libelle =
    f.type === "installation"
      ? "Kaya : frais d'installation"
      : `Kaya : abonnement ${f.plan_code ?? ""}`.trim();
  const cree = await creerLienPaiement(
    s.fapshi,
    {
      montant: Number(f.montant_brut),
      externalId: f.id,
      message: libelle,
      redirectUrl: lienFacture(s.urlApp, f.id),
      userId: String(f.organisation_id).replace(/[^A-Za-z0-9_-]/g, ""),
    },
    s.http,
  );
  // Le paiement n'est possible que sur le nouveau lien : l'ancien est invalidé (échec sans conséquence).
  if (f.trans_id && f.lien_paiement)
    await expirerLien(s.fapshi, f.trans_id, s.http).catch(() => undefined);
  await s.db
    .from("factures_abonnement")
    .update({
      lien_paiement: cree.lien,
      trans_id: cree.transId,
      lien_expire_le: new Date(
        maintenant.getTime() + 24 * UNE_HEURE - 60_000,
      ).toISOString(),
    })
    .eq("id", f.id)
    .eq("statut", "a_payer");
  return { type: "lien", url: cree.lien };
}

/**
 * Filet de sécurité : Fapshi ne renvoie pas un webhook perdu. On relit les liens ouverts depuis moins de 3 jours.
 */
export async function reconcilier(
  s: Services,
): Promise<{ verifies: number; confirmes: number; erreurs: number }> {
  const r = { verifies: 0, confirmes: 0, erreurs: 0 };
  if (!s.fapshi) return r;
  const depuis = new Date(Date.now() - 3 * 24 * UNE_HEURE).toISOString();
  const { data } = await s.db
    .from("factures_abonnement")
    .select("id, trans_id")
    .eq("statut", "a_payer")
    .eq("mode", "fapshi")
    .not("trans_id", "is", null)
    .gte("modifie_le", depuis)
    .limit(200);
  for (const f of data ?? []) {
    r.verifies++;
    try {
      const c = await confirmerPaiement(s, String(f.trans_id), String(f.id));
      if (c.type === "confirme") r.confirmes++;
    } catch {
      r.erreurs++;
    }
  }
  return r;
}

interface RelanceReservee {
  envoi_id: string;
  facture_id: string;
  etape: EtapeRelance;
  destinataire: string;
  boutique_nom: string | null;
  montant: number | string;
  echeance: string;
}

/**
 * Envoie les relances dues (J-3, J, J+2, J+5). La base réserve chaque envoi une seule fois ; un échec est noté
 * (et retenté à la prochaine exécution, 3 fois au plus) sans jamais bloquer le reste.
 */
export async function envoyerRelances(
  s: Services,
): Promise<{ envoyees: number; echecs: number }> {
  const r = { envoyees: 0, echecs: 0 };
  if (!s.zernio) return r;
  const { data } = await s.db.rpc("reserver_relances");
  for (const x of (data ?? []) as RelanceReservee[]) {
    const tel = telephoneInternational(x.destinataire);
    const resultat = tel
      ? await envoyerModele(
          s.zernio,
          {
            telephone: tel,
            modele: MODELES[x.etape],
            langue: LANGUE_MODELES,
            variables: variablesRelance({
              boutique: x.boutique_nom ?? "",
              montant: Number(x.montant),
              echeance: new Date(x.echeance),
              lien: lienFacture(s.urlApp, x.facture_id),
            }),
          },
          s.http,
        )
      : ({ ok: false, erreur: "Numéro invalide" } as const);
    await s.db
      .from("envois_whatsapp")
      .update(
        resultat.ok
          ? { statut: "envoye", erreur: null }
          : { statut: "echec", erreur: resultat.erreur },
      )
      .eq("id", x.envoi_id);
    if (resultat.ok) r.envoyees++;
    else r.echecs++;
  }
  return r;
}

export interface RapportCron {
  echeances: unknown;
  paiements: { verifies: number; confirmes: number; erreurs: number } | null;
  relances: { envoyees: number; echecs: number } | null;
  erreurs: string[];
}

/** Tâche quotidienne. Chaque étape est isolée : une panne de Fapshi ou de WhatsApp n'empêche ni la suspension ni le reste. */
export async function executerCron(s: Services): Promise<RapportCron> {
  const rapport: RapportCron = {
    echeances: null,
    paiements: null,
    relances: null,
    erreurs: [],
  };
  // 1. Paiements perdus d'abord : un client qui a payé ne doit pas être suspendu par erreur.
  try {
    rapport.paiements = await reconcilier(s);
  } catch {
    rapport.erreurs.push("reconciliation");
  }
  try {
    const { data, error } = await s.db.rpc("traiter_echeances");
    if (error) throw error;
    rapport.echeances = data;
  } catch {
    rapport.erreurs.push("echeances");
  }
  try {
    rapport.relances = await envoyerRelances(s);
  } catch {
    rapport.erreurs.push("relances");
  }
  return rapport;
}
