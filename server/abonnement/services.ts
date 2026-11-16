import "server-only";
import { configFapshi, configZernio, urlApplication } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Services } from "./coeur";

/** Services réels (clés lues côté serveur uniquement). */
export function servicesAbonnement(): Services {
  return {
    db: supabaseAdmin(),
    fapshi: configFapshi(),
    zernio: configZernio(),
    urlApp: urlApplication(),
  };
}
