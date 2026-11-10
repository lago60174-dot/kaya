import { createBrowserClient } from "@supabase/ssr";
import { envPublic } from "@/lib/env";

export function supabaseNavigateur() {
  const env = envPublic();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
