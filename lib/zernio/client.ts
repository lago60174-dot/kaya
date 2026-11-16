import { z } from "zod";

/**
 * Client Zernio (WhatsApp Business) : envoi d'un modèle approuvé via POST /api/v1/whatsapp/bulk.
 * Usage limité au résumé quotidien et aux relances d'abonnement. Jamais pour les reçus.
 * Un échec ne doit jamais bloquer l'application : l'appelant journalise et continue.
 */
export interface ConfigZernio {
  cleApi: string;
  compteId: string;
}

const URL_ZERNIO = "https://zernio.com/api/v1/whatsapp/bulk";

export interface EnvoiModele {
  /** Format international (+237...). */
  telephone: string;
  modele: string;
  langue: string;
  variables: Record<string, string>;
}

export type ResultatEnvoi = { ok: true } | { ok: false; erreur: string };

const corpsErreur = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

export async function envoyerModele(
  cfg: ConfigZernio,
  envoi: EnvoiModele,
  http: typeof fetch = fetch,
): Promise<ResultatEnvoi> {
  try {
    const r = await http(URL_ZERNIO, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.cleApi}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accountId: cfg.compteId,
        recipients: [{ phone: envoi.telephone, variables: envoi.variables }],
        template: { name: envoi.modele, language: envoi.langue },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return { ok: true };
    const json = corpsErreur.safeParse(await r.json().catch(() => null));
    // Jamais le numéro ni la clé dans l'erreur journalisée.
    const detail = json.success
      ? (json.data.error ?? json.data.message ?? "")
      : "";
    return {
      ok: false,
      erreur: `HTTP ${r.status} ${detail}`.trim().slice(0, 200),
    };
  } catch {
    return { ok: false, erreur: "Zernio injoignable" };
  }
}
