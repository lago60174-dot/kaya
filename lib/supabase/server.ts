import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { envPublic } from "@/lib/env";

/** Client Supabase du serveur, avec la session de l'utilisateur (soumis à la RLS). */
export async function supabaseServeur() {
  const env = envPublic();
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (liste) => {
          try {
            liste.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appel depuis un composant serveur : le proxy se charge de rafraîchir la session.
          }
        },
      },
    },
  );
}
