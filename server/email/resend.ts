import "server-only";

export interface Email {
  a: string;
  sujet: string;
  html: string;
  texte: string;
}

/** Vrai quand Resend est configuré (clé et adresse d'expédition vérifiée). */
export const emailConfigure = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_EXPEDITEUR);

/**
 * Envoie un email par l'API Resend. Ne lève jamais d'erreur : un email manqué ne doit pas bloquer une inscription.
 * Renvoie false si Resend n'est pas configuré ou refuse l'envoi.
 */
export async function envoyerEmail(m: Email): Promise<boolean> {
  const cle = process.env.RESEND_API_KEY;
  const de = process.env.EMAIL_EXPEDITEUR;
  if (!cle || !de) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: de,
        to: [m.a],
        subject: m.sujet,
        html: m.html,
        text: m.texte,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
