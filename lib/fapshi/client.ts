import { z } from "zod";

/**
 * Client Fapshi (https://docs.fapshi.com). Réservé aux abonnements de Kaya :
 * Fapshi ne sert jamais à encaisser les clients des boutiques.
 * `fetch` est injectable pour tester sans réseau.
 */
export interface ConfigFapshi {
  apiUser: string;
  apiKey: string;
  /** https://live.fapshi.com ou https://sandbox.fapshi.com */
  baseUrl: string;
}
export type Fetch = typeof fetch;

export const STATUTS_FAPSHI = [
  "CREATED",
  "PENDING",
  "SUCCESSFUL",
  "FAILED",
  "EXPIRED",
] as const;
export type StatutFapshi = (typeof STATUTS_FAPSHI)[number];

export class ErreurFapshi extends Error {
  constructor(
    message: string,
    readonly statutHttp?: number,
  ) {
    super(message);
    this.name = "ErreurFapshi";
  }
}

/** Fapshi n'accepte que a-z A-Z 0-9 - _ (1 à 100 caractères) pour externalId et userId. */
export const identifiantFapshiValide = (id: string) =>
  /^[A-Za-z0-9_-]{1,100}$/.test(id);

const reponseLien = z.object({ link: z.url(), transId: z.string().min(1) });
const reponseStatut = z.object({
  transId: z.string().min(1),
  status: z.enum(STATUTS_FAPSHI),
  amount: z.coerce.number().int().optional(),
  revenue: z.coerce.number().int().optional(),
  externalId: z.string().nullish(),
});
export type StatutPaiement = z.infer<typeof reponseStatut>;

async function appeler(
  cfg: ConfigFapshi,
  http: Fetch,
  methode: "GET" | "POST",
  chemin: string,
  corps?: unknown,
): Promise<unknown> {
  let reponse: Response;
  try {
    reponse = await http(`${cfg.baseUrl}${chemin}`, {
      method: methode,
      headers: {
        apiuser: cfg.apiUser,
        apikey: cfg.apiKey,
        "content-type": "application/json",
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ErreurFapshi("Fapshi est injoignable.");
  }
  const json: unknown = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    // Le message de Fapshi est repris tel quel (il ne contient ni clé ni donnée client), jamais les en-têtes.
    const m =
      json && typeof json === "object" && "message" in json
        ? String((json as { message: unknown }).message).slice(0, 200)
        : "Réponse inattendue";
    throw new ErreurFapshi(`Fapshi : ${m}`, reponse.status);
  }
  return json;
}

export interface DemandeLien {
  /** Entier FCFA, minimum 100. */
  montant: number;
  /** Notre identifiant de facture. */
  externalId: string;
  message: string;
  redirectUrl: string;
  userId?: string;
}

/** Crée un lien de paiement valable 24 h. */
export async function creerLienPaiement(
  cfg: ConfigFapshi,
  demande: DemandeLien,
  http: Fetch = fetch,
): Promise<{ lien: string; transId: string }> {
  if (!Number.isInteger(demande.montant) || demande.montant < 100)
    throw new ErreurFapshi("Le montant minimum est de 100 FCFA.");
  if (!identifiantFapshiValide(demande.externalId))
    throw new ErreurFapshi("Identifiant de facture invalide.");
  const json = await appeler(cfg, http, "POST", "/initiate-pay", {
    amount: demande.montant,
    externalId: demande.externalId,
    message: demande.message.slice(0, 200),
    redirectUrl: demande.redirectUrl,
    ...(demande.userId && identifiantFapshiValide(demande.userId)
      ? { userId: demande.userId }
      : {}),
  });
  const r = reponseLien.safeParse(json);
  if (!r.success) throw new ErreurFapshi("Fapshi : réponse invalide.");
  return { lien: r.data.link, transId: r.data.transId };
}

/** État réel d'une transaction (source de vérité : on ne se fie jamais seulement au webhook). */
export async function lireStatutPaiement(
  cfg: ConfigFapshi,
  transId: string,
  http: Fetch = fetch,
): Promise<StatutPaiement> {
  if (!identifiantFapshiValide(transId))
    throw new ErreurFapshi("Identifiant de transaction invalide.");
  const json = await appeler(
    cfg,
    http,
    "GET",
    `/payment-status/${encodeURIComponent(transId)}`,
  );
  const r = reponseStatut.safeParse(json);
  if (!r.success) throw new ErreurFapshi("Fapshi : réponse invalide.");
  return r.data;
}

/** Invalide un lien encore ouvert. Un lien déjà expiré n'est pas une erreur. */
export async function expirerLien(
  cfg: ConfigFapshi,
  transId: string,
  http: Fetch = fetch,
): Promise<void> {
  try {
    await appeler(cfg, http, "POST", "/expire-pay", { transId });
  } catch (e) {
    if (e instanceof ErreurFapshi && e.statutHttp === 400) return;
    throw e;
  }
}

/** Frais Fapshi : montant - revenue si connu, sinon 3 % arrondi (taux publié par Fapshi). */
export function fraisPaiement(montant: number, revenu?: number): number {
  if (revenu !== undefined && revenu >= 0 && revenu <= montant)
    return montant - revenu;
  return Math.round(montant * 0.03);
}
