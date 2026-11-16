import { z } from "zod";

const schemaPublic = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const schemaServeur = schemaPublic.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  // Emails (Resend) : sans clé, aucun email n'est envoyé et l'application fonctionne quand même.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_EXPEDITEUR: z.string().min(3).optional(),
  // Notifications push : clés générées avec `npx web-push generate-vapid-keys`.
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  // Abonnements : tous optionnels, la fonctionnalité reste inactive tant qu'ils manquent.
  FAPSHI_API_USER: z.string().min(1).optional(),
  FAPSHI_API_KEY: z.string().min(1).optional(),
  FAPSHI_WEBHOOK_SECRET: z.string().min(16).optional(),
  FAPSHI_BASE_URL: z.url().optional(),
  ZERNIO_API_KEY: z.string().min(1).optional(),
  ZERNIO_ACCOUNT_ID: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
});

/** Variables lisibles côté navigateur. */
export function envPublic() {
  return schemaPublic.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** Variables serveur uniquement. Ne jamais importer depuis un composant client. */
export function envServeur() {
  // Accès littéraux : Next remplace les NEXT_PUBLIC_* au build.
  return schemaServeur.parse({
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** Accès R2 (envoi par URL signée). Null tant que les secrets ne sont pas configurés. */
export function configR2() {
  const e = envServeur();
  if (
    !e.R2_ACCOUNT_ID ||
    !e.R2_ACCESS_KEY_ID ||
    !e.R2_SECRET_ACCESS_KEY ||
    !e.R2_BUCKET
  )
    return null;
  return {
    compteId: e.R2_ACCOUNT_ID,
    cleAcces: e.R2_ACCESS_KEY_ID,
    cleSecrete: e.R2_SECRET_ACCESS_KEY,
    bucket: e.R2_BUCKET,
  };
}

/** Accès Fapshi (abonnements de Kaya uniquement, jamais les paiements des clients des boutiques). Null si non configuré. */
export function configFapshi() {
  const e = envServeur();
  if (!e.FAPSHI_API_USER || !e.FAPSHI_API_KEY) return null;
  return {
    apiUser: e.FAPSHI_API_USER,
    apiKey: e.FAPSHI_API_KEY,
    baseUrl: e.FAPSHI_BASE_URL ?? "https://live.fapshi.com",
  };
}

/** Accès Zernio (WhatsApp : relances d'abonnement et résumé quotidien). Null si non configuré. */
export function configZernio() {
  const e = envServeur();
  if (!e.ZERNIO_API_KEY || !e.ZERNIO_ACCOUNT_ID) return null;
  return { cleApi: e.ZERNIO_API_KEY, compteId: e.ZERNIO_ACCOUNT_ID };
}

/** Adresse publique de l'application (liens de paiement, redirections). Sur Vercel : NEXT_PUBLIC_APP_URL, sinon le domaine de production. */
export function urlApplication(): string {
  const e = envServeur();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (
    e.NEXT_PUBLIC_APP_URL ??
    (vercel ? `https://${vercel}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}
