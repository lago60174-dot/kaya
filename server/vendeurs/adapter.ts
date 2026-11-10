import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PortAdmin } from "./service";

/** Branche le service des vendeurs sur Supabase (clé service_role, serveur uniquement). */
export function portAdminSupabase(): PortAdmin {
  const admin = supabaseAdmin();
  return {
    async creerUtilisateur({ email, motDePasse, nom }) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: motDePasse,
        email_confirm: true,
        user_metadata: { nom },
        app_metadata: { doit_changer_mot_de_passe: true },
      });
      if (error || !data.user)
        return { ok: false, emailExiste: error?.code === "email_exists" };
      return { ok: true, id: data.user.id };
    },
    async supprimerUtilisateur(id) {
      await admin.auth.admin.deleteUser(id);
    },
    async insererMembre({ utilisateurId, organisationId, boutiqueIds, nom }) {
      const { error } = await admin.from("membres").insert({
        utilisateur_id: utilisateurId,
        organisation_id: organisationId,
        role: "vendeur",
        boutiques_autorisees: boutiqueIds,
        nom,
        actif: true,
      });
      // Les messages levés par la base (limite du plan) sont déjà en français.
      return error
        ? {
            ok: false,
            message:
              error.code === "P0001"
                ? error.message
                : "L'opération a échoué. Réessayez dans un instant.",
          }
        : { ok: true };
    },
    async lireMembre(id) {
      const { data } = await admin
        .from("membres")
        .select("id, utilisateur_id, organisation_id, role, actif")
        .eq("id", id)
        .maybeSingle();
      return data
        ? {
            id: data.id,
            utilisateurId: data.utilisateur_id,
            organisationId: data.organisation_id,
            role: data.role,
            actif: data.actif,
          }
        : null;
    },
    async mettreAJourActif(id, actif) {
      const { error } = await admin
        .from("membres")
        .update({ actif })
        .eq("id", id);
      return error
        ? {
            ok: false,
            message:
              error.code === "P0001"
                ? error.message
                : "L'opération a échoué. Réessayez dans un instant.",
          }
        : { ok: true };
    },
    async definirBlocage(utilisateurId, bloque) {
      await admin.auth.admin.updateUserById(utilisateurId, {
        ban_duration: bloque ? "876000h" : "none",
      });
    },
    async definirMotDePasseProvisoire(utilisateurId, motDePasse) {
      await admin.auth.admin.updateUserById(utilisateurId, {
        password: motDePasse,
        app_metadata: { doit_changer_mot_de_passe: true },
      });
    },
  };
}
