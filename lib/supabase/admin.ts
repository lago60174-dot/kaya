import "server-only";
import { createClient } from "@supabase/supabase-js";
import { envServeur } from "@/lib/env";

/** Clé service_role : contourne la RLS. Serveur uniquement, après vérification du rôle de l'appelant. */
export function supabaseAdmin() {
  const env = envServeur();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
