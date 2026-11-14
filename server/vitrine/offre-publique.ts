import "server-only";
import { planDepuisLigne, plansVisibles, type Plan } from "@/lib/plans";
import { supabasePublic } from "@/lib/supabase/public";
import { avecCache } from "@/lib/vitrine/cache";
import { programmeDepuisJson, type ProgrammePublic } from "@/lib/vitrine/offre";

export interface OffrePublique {
  plans: Plan[];
  programme: ProgrammePublic | null;
}

const UNE_MINUTE = 60_000;

/** Plans visibles (la RLS cache déjà les autres au rôle anonyme ; on filtre aussi ici) et chiffres du programme. */
async function lireOffre(): Promise<OffrePublique | null> {
  try {
    const supabase = supabasePublic();
    const [plans, programme] = await Promise.all([
      supabase
        .from("plans")
        .select(
          "code, nom, prix_mensuel, fonctionnalites, limites, visible_public, ordre",
        )
        .eq("visible_public", true)
        .order("ordre"),
      supabase.rpc("programme_partenaire_public"),
    ]);
    if (plans.error) return null;
    return {
      plans: plansVisibles((plans.data ?? []).map(planDepuisLigne)),
      programme: programme.error ? null : programmeDepuisJson(programme.data),
    };
  } catch {
    // Base injoignable ou ligne inattendue : la page s'affiche quand même, sans tarifs inventés.
    return null;
  }
}

const lireAvecCache = avecCache(UNE_MINUTE, lireOffre);

/** Offre affichée aux visiteurs. Activer un plan depuis l'administration apparaît en moins d'une minute, sans redéploiement. */
export async function chargerOffrePublique(): Promise<OffrePublique> {
  return (await lireAvecCache()) ?? { plans: [], programme: null };
}
