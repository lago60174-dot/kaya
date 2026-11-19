import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  choisirBoutiqueActive,
  lireBoutiquesAccessibles,
  type BoutiqueAccessible,
} from "@/lib/boutiques/active";
import type { Role } from "@/lib/permissions";
import { planDepuisLigne, type Plan } from "@/lib/plans";

export interface Profil {
  userId: string;
  email: string;
  role: Role | null; // null : compte désactivé ou affilié pas encore validé
  nom: string | null;
  organisationId: string | null;
  /** Boutiques accessibles : toutes celles de l'organisation pour un propriétaire, celles attribuées pour un vendeur. */
  boutiques: BoutiqueAccessible[];
  boutiqueIds: string[];
  /** Boutique dans laquelle il travaille en ce moment (son choix, sinon la plus ancienne). */
  boutiqueActiveId: string | undefined;
  doitChangerMotDePasse: boolean;
  /** Adresse email confirmée par un clic sur le lien reçu. */
  emailVerifie: boolean;
  plan: Plan | null;
  /** Inscrit comme administrateur de la plateforme (en plus de son rôle de boutique éventuel). */
  estAdmin: boolean;
  /** Propriétaire dont la formule n'a pas encore été choisie (étape obligatoire de la création de la boutique). */
  planAChoisir: boolean;
}

/** Charge le rôle, l'organisation et le plan. Tout passe par la RLS : un compte désactivé ne voit rien. */
export async function chargerProfil(
  supabase: SupabaseClient,
  user: User,
  boutiqueDemandee?: string | null,
): Promise<Profil> {
  const base: Profil = {
    userId: user.id,
    email: user.email ?? "",
    role: null,
    nom: null,
    organisationId: null,
    boutiques: [],
    boutiqueIds: [],
    boutiqueActiveId: undefined,
    doitChangerMotDePasse:
      user.app_metadata?.doit_changer_mot_de_passe === true,
    emailVerifie: user.app_metadata?.email_verifie === true,
    plan: null,
    estAdmin: false,
    planAChoisir: false,
  };

  const { data: ligneAdmin } = await supabase
    .from("administrateurs_plateforme")
    .select("utilisateur_id")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  base.estAdmin = !!ligneAdmin;

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
    // La base filtre déjà selon le rôle (RLS) : un vendeur ne reçoit que ses boutiques.
    const { data: brutes } = await supabase.rpc("lister_boutiques");
    const boutiques = lireBoutiquesAccessibles(brutes);
    const boutiqueIds = boutiques.map((b) => b.id);
    return {
      ...base,
      role: membre.role as Role,
      nom: membre.nom,
      organisationId: membre.organisation_id,
      boutiques,
      boutiqueIds,
      boutiqueActiveId: choisirBoutiqueActive(boutiqueDemandee, boutiqueIds),
      plan: ligne ? planDepuisLigne(ligne) : null,
      planAChoisir: membre.role === "proprietaire" && !!org && !org.plan_choisi_le,
    };
  }

  if (base.estAdmin) return { ...base, role: "administrateur_plateforme" };

  const { data: affilie } = await supabase
    .from("affilies")
    .select("actif, nom")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (affilie?.actif) return { ...base, role: "affilie", nom: affilie.nom };
  return base;
}
