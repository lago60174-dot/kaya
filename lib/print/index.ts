import { estAndroid, lienRawBT } from "./rawbt";

/**
 * Point d'entrée UNIQUE de l'impression. Tout le reste de l'application n'appelle que `imprimerRecu` :
 * remplacer RawBT par une application Android native ne touchera que ce dossier.
 */
export type FormatImpression = "ticket" | "a4";

export interface RecuImprimable {
  /** Pour le message à l'écran (ex. R-2026-000123). */
  numero: string;
  /** Octets ESC/POS du ticket 58 mm, fournis par le serveur (route protégée par le plan). */
  escpos: () => Promise<Uint8Array>;
  /** Repli : le PDF du reçu. */
  pdfUrl: string;
}

export type MethodeImpression = "rawbt" | "navigateur" | "pdf";

export type ResultatImpression =
  { ok: true; methode: MethodeImpression } | { ok: false; message: string };

/** Ce dont l'impression a besoin du navigateur. Injectable pour tester sans téléphone ni imprimante. */
export interface Environnement {
  userAgent: string;
  /** Ouvre un lien (ici l'intention Android vers RawBT). */
  ouvrirLien(lien: string): void;
  /** Ouvre la boîte d'impression du navigateur au bon format. */
  imprimerPage(format: FormatImpression): Promise<void>;
  ouvrirPdf(url: string): void;
}

const MESSAGE_ECHEC =
  "L'impression n'a pas abouti. La vente est bien enregistrée : réessayez ou ouvrez le PDF.";

/**
 * Imprime un reçu, sans jamais lever d'erreur : l'impression ne doit jamais bloquer la vente.
 * Ordre : (1) ticket vers RawBT sur Android, (2) boîte d'impression du navigateur (ticket ou A4, PC),
 * (3) PDF en dernier recours. Un échec renvoie un message clair, l'écran propose alors « Réessayer ».
 */
export async function imprimerRecu(
  recu: RecuImprimable,
  format: FormatImpression,
  env: Environnement,
): Promise<ResultatImpression> {
  if (format === "ticket" && estAndroid(env.userAgent)) {
    try {
      env.ouvrirLien(lienRawBT(await recu.escpos()));
      return { ok: true, methode: "rawbt" };
    } catch {
      // repli : boîte d'impression du navigateur
    }
  }
  try {
    await env.imprimerPage(format);
    return { ok: true, methode: "navigateur" };
  } catch {
    // dernier recours : le PDF
  }
  try {
    env.ouvrirPdf(recu.pdfUrl);
    return { ok: true, methode: "pdf" };
  } catch {
    return { ok: false, message: MESSAGE_ECHEC };
  }
}
