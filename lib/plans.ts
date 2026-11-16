import { z } from "zod";

/** Fonctionnalités liées au plan. Le reste (stock, ventes, crédits, caisse...) est commun à tous. */
export const FONCTIONNALITES = [
  "journal_complet",
  "devis",
  "fournisseurs",
  "impression",
  "multi_boutiques",
  "resume_whatsapp",
] as const;
export type Fonctionnalite = (typeof FONCTIONNALITES)[number];
export type CleLimite = "vendeurs" | "boutiques";

export interface Plan {
  code: string;
  nom: string;
  prixMensuel: number;
  fonctionnalites: Partial<Record<Fonctionnalite, boolean>>;
  limites: Partial<Record<CleLimite, number | null>>;
  visiblePublic: boolean;
  ordre: number;
}

const ligneSql = z.object({
  code: z.string(),
  nom: z.string(),
  prix_mensuel: z.coerce.number().int().nonnegative(),
  fonctionnalites: z.record(z.string(), z.boolean()),
  limites: z.record(z.string(), z.number().int().nullable()),
  visible_public: z.boolean(),
  ordre: z.number().int(),
});

/** Convertit une ligne de la table `plans` en objet Plan. */
export function planDepuisLigne(ligne: unknown): Plan {
  const l = ligneSql.parse(ligne);
  return {
    code: l.code,
    nom: l.nom,
    prixMensuel: l.prix_mensuel,
    fonctionnalites: l.fonctionnalites,
    limites: l.limites,
    visiblePublic: l.visible_public,
    ordre: l.ordre,
  };
}

export function peutUtiliser(plan: Plan, fonction: Fonctionnalite): boolean {
  return plan.fonctionnalites[fonction] === true;
}

/** Limite du plan. null = illimité. Une limite absente vaut 0 (même règle qu'en SQL). */
export function limite(plan: Plan, cle: CleLimite): number | null {
  if (!(cle in plan.limites)) return 0;
  return plan.limites[cle] ?? null;
}

export type VerificationLimite = { ok: true } | { ok: false; message: string };

/** Contrôle avant création. Le message ne pousse pas à changer de plan (autres plans masqués). */
export function verifierLimite(
  plan: Plan,
  cle: CleLimite,
  usageActuel: number,
): VerificationLimite {
  const max = limite(plan, cle);
  if (max === null || usageActuel < max) return { ok: true };
  const pluriel = max > 1 ? "s" : "";
  if (cle === "vendeurs") {
    return {
      ok: false,
      message: `Votre abonnement permet ${max} vendeur${pluriel} actif${pluriel}. Désactivez un vendeur pour en ajouter un autre.`,
    };
  }
  return {
    ok: false,
    message: `Votre abonnement permet ${max} boutique${pluriel}.`,
  };
}

/** Seuls les plans visibles apparaissent sur la landing page et à l'inscription. */
export function plansVisibles(plans: Plan[]): Plan[] {
  return plans.filter((p) => p.visiblePublic).sort((a, b) => a.ordre - b.ordre);
}

export type StatutAbonnement =
  "en_attente" | "actif" | "en_retard" | "suspendu" | "annule";

/** Un compte suspendu ou annulé passe en lecture seule. Rien n'est supprimé. */
export function ecritureAutorisee(statut: StatutAbonnement): boolean {
  return statut === "en_attente" || statut === "actif" || statut === "en_retard";
}
