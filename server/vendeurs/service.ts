import {
  creerVendeurSchema,
  genererMotDePasseProvisoire,
} from "@/lib/auth/schemas";
import { verifierLimite, type Plan } from "@/lib/plans";

export type Resultat<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; erreur: string; champs?: Record<string, string> };

export interface MembreLu {
  id: string;
  utilisateurId: string;
  organisationId: string;
  role: string;
  actif: boolean;
}

/** Opérations privilégiées (clé service_role). Branché sur Supabase dans adapter.ts. */
export interface PortAdmin {
  creerUtilisateur(a: {
    email: string;
    motDePasse: string;
    nom: string;
  }): Promise<{ ok: true; id: string } | { ok: false; emailExiste: boolean }>;
  supprimerUtilisateur(id: string): Promise<void>;
  insererMembre(a: {
    utilisateurId: string;
    organisationId: string;
    boutiqueIds: string[];
    nom: string;
  }): Promise<{ ok: true } | { ok: false; message: string }>;
  lireMembre(id: string): Promise<MembreLu | null>;
  mettreAJourActif(
    id: string,
    actif: boolean,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  definirBlocage(utilisateurId: string, bloque: boolean): Promise<void>;
  definirMotDePasseProvisoire(
    utilisateurId: string,
    motDePasse: string,
  ): Promise<void>;
}

/** Contexte du propriétaire connecté, déjà vérifié par la session. */
export interface ContexteProprietaire {
  organisationId: string;
  boutiqueIds: string[];
  plan: Plan;
  vendeursActifs: number;
}

const MESSAGE_GENERIQUE = "L'opération a échoué. Réessayez dans un instant.";

export async function creerVendeur(
  port: PortAdmin,
  ctx: ContexteProprietaire,
  entree: unknown,
  octetsAleatoires: Uint8Array,
): Promise<Resultat<{ email: string; motDePasseProvisoire: string }>> {
  const lu = creerVendeurSchema.safeParse(entree);
  if (!lu.success) {
    const champs: Record<string, string> = {};
    for (const i of lu.error.issues) champs[String(i.path[0])] ??= i.message;
    return { ok: false, erreur: "Vérifiez les champs en rouge.", champs };
  }
  const limite = verifierLimite(ctx.plan, "vendeurs", ctx.vendeursActifs);
  if (!limite.ok) return { ok: false, erreur: limite.message };

  const motDePasse = genererMotDePasseProvisoire(octetsAleatoires);
  const cree = await port.creerUtilisateur({
    email: lu.data.email,
    motDePasse,
    nom: lu.data.nom,
  });
  if (!cree.ok) {
    return {
      ok: false,
      erreur: cree.emailExiste
        ? "Cette adresse email est déjà utilisée."
        : MESSAGE_GENERIQUE,
    };
  }
  const membre = await port.insererMembre({
    utilisateurId: cree.id,
    organisationId: ctx.organisationId,
    boutiqueIds: ctx.boutiqueIds,
    nom: lu.data.nom,
  });
  if (!membre.ok) {
    await port.supprimerUtilisateur(cree.id); // aucun compte orphelin
    return { ok: false, erreur: membre.message };
  }
  return { ok: true, email: lu.data.email, motDePasseProvisoire: motDePasse };
}

async function vendeurDeMonOrganisation(
  port: PortAdmin,
  ctx: ContexteProprietaire,
  membreId: string,
) {
  const m = await port.lireMembre(membreId);
  // Même message si le compte n'existe pas ou appartient à une autre organisation.
  if (!m || m.organisationId !== ctx.organisationId || m.role !== "vendeur")
    return null;
  return m;
}

export async function changerEtatVendeur(
  port: PortAdmin,
  ctx: ContexteProprietaire,
  membreId: string,
  actif: boolean,
): Promise<Resultat> {
  const m = await vendeurDeMonOrganisation(port, ctx, membreId);
  if (!m) return { ok: false, erreur: "Vendeur introuvable." };
  if (actif && !m.actif) {
    const limite = verifierLimite(ctx.plan, "vendeurs", ctx.vendeursActifs);
    if (!limite.ok) return { ok: false, erreur: limite.message };
  }
  const maj = await port.mettreAJourActif(m.id, actif);
  if (!maj.ok) return { ok: false, erreur: maj.message };
  await port.definirBlocage(m.utilisateurId, !actif); // un vendeur désactivé ne peut plus ouvrir de session
  return { ok: true };
}

export async function reinitialiserMotDePasseVendeur(
  port: PortAdmin,
  ctx: ContexteProprietaire,
  membreId: string,
  octetsAleatoires: Uint8Array,
): Promise<Resultat<{ motDePasseProvisoire: string }>> {
  const m = await vendeurDeMonOrganisation(port, ctx, membreId);
  if (!m) return { ok: false, erreur: "Vendeur introuvable." };
  const motDePasse = genererMotDePasseProvisoire(octetsAleatoires);
  await port.definirMotDePasseProvisoire(m.utilisateurId, motDePasse);
  return { ok: true, motDePasseProvisoire: motDePasse };
}
