import { z } from "zod";

const schemaPublic = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const schemaServeur = schemaPublic.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
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
