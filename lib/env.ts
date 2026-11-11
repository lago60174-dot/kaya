import { z } from "zod";

const schemaPublic = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const schemaServeur = schemaPublic.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
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
  return schemaServeur.parse(process.env);
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
