import { roleAutorise, type Role } from "@/lib/permissions";
import { peutUtiliser, type Plan } from "@/lib/plans";

export type AccesImpression =
  { ok: true } | { ok: false; statut: 401 | 403; message: string };

/**
 * Qui peut obtenir un ticket ou une facture à imprimer : un membre d'une boutique dont le plan inclut l'impression.
 * Appelée par chaque route d'impression (la plan n'est jamais vérifié seulement dans l'interface).
 */
export function accesImpression(
  session: { role: Role | null; plan: Plan | null } | null,
): AccesImpression {
  if (!session || !roleAutorise(session.role, "boutique"))
    return { ok: false, statut: 401, message: "Non autorisé" };
  if (!session.plan || !peutUtiliser(session.plan, "impression"))
    return {
      ok: false,
      statut: 403,
      message: "L'impression n'est pas incluse dans votre abonnement.",
    };
  return { ok: true };
}
