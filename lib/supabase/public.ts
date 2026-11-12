import { createClient } from "@supabase/supabase-js";
import { envPublic } from "@/lib/env";

/** Client sans session : pour les pages publiques (rôle anonyme, donc soumis à la RLS et aux droits de `anon`). */
export function supabasePublic() {
  const env = envPublic();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
