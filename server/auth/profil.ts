import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Role } from "@/lib/permissions";
import { planDepuisLigne, type Plan } from "@/lib/plans";

export interface Profil {
  userId: string;
  email: string;
  role: Role | null; // null : compte désactivé ou affilié pas encore validé
  nom: string | null;
  organisationId: string | null;
  boutiqueIds: string[];
  doitChangerMotDePasse: boolean;
  /** Adresse email confirmée par un clic sur le lien reçu. */
  emailVerifie: boolean;
  plan: Plan | null;
  /** Propriétaire sans formule choisie : bloqué sur /choisir-plan jusqu'au choix (le paiement peut venir plus tard). */
  planAChoisir: boolean;
}

/** Charge le rôle, l'organisation et le plan. Tout passe par la RLS : un compte désactivé ne voit rien. */
export async function chargerProfil(
  supabase: SupabaseClient,
  user: User,
): Promise<Profil> {
  const base: Profil = {
    userId: user.id,
    email: user.email ?? "",
    role: null,
    nom: null,
    organisationId: null,
    boutiqueIds: [],
    doitChangerMotDePasse:
      user.app_metadata?.doit_changer_mot_de_passe === true,
    emailVerifie: user.app_metadata?.email_verifie === true,
    plan: null,
    planAChoisir: false,
  };

  const { data: membre } = await supabase
    .from("membres")
    .select("role, organisation_id, boutiques_autorisees, nom, actif")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (membre?.actif) {
    const { data: org } = await supabase
      .from("organisations")
      .select("plan_code, plan_choisi_le")
      .eq("id", membre.organisation_id)
      .maybeSingle();
    const { data: ligne } = org
      ? await supabase
          .from("plans")
          .select("*")
          .eq("code", org.plan_code)
          .maybeSingle()
      : { data: null };
    return {
      ...base,
      role: membre.role as Role,
      nom: membre.nom,
      organisationId: membre.organisation_id,
      boutiqueIds: membre.boutiques_autorisees ?? [],
      plan: ligne ? planDepuisLigne(ligne) : null,
      planAChoisir: membre.role === "proprietaire" && org?.plan_choisi_le == null,
    };
  }

  const { data: admin } = await supabase
    .from("administrateurs_plateforme")
    .select("utilisateur_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (admin) return { ...base, role: "administrateur_plateforme" };

  const { data: affilie } = await supabase
    .from("affilies")
    .select("actif, nom")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (affilie?.actif) return { ...base, role: "affilie", nom: affilie.nom };
  return base;
}
