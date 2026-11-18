"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";

export interface EtatAdmin {
  erreur?: string;
  ok?: string;
}

const uuid = z.uuid();
const MESSAGE_ERREUR = "L'opération a échoué. Vérifiez les champs et réessayez.";

/** Les fonctions SQL lèvent des messages en français (P0001) : on les montre tels quels, sinon message générique. */
function erreurPour(error: { code?: string; message: string }): string {
  return error.code === "P0001" ? error.message : MESSAGE_ERREUR;
}

export async function paiementManuelAction(_e: EtatAdmin, f: FormData): Promise<EtatAdmin> {
  await exigerRole("admin");
  const lu = z
    .object({
      org: uuid,
      type: z.enum(["abonnement", "installation"]),
      montant: z.coerce.number().int().min(1).max(100_000_000),
      mois: z.coerce.number().int().refine((n) => n === 1 || n === 12),
      reference: z.string().trim().min(2).max(80),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(f));
  if (!lu.success) return { erreur: "Montant, durée (1 ou 12 mois) et référence sont obligatoires." };
  const d = lu.data;
  const { error } = await (await supabaseServeur()).rpc("enregistrer_paiement_manuel", {
    p_org: d.org,
    p_type: d.type,
    p_montant: d.montant,
    p_mois: d.mois,
    p_reference: d.reference,
    p_note: d.note || null,
  });
  if (error) return { erreur: erreurPour(error) };
  revalidatePath(`/admin/boutiques/${d.org}`);
  revalidatePath("/admin");
  return { ok: "Paiement enregistré." };
}

export async function changerPlanAction(_e: EtatAdmin, f: FormData): Promise<EtatAdmin> {
  await exigerRole("admin");
  const lu = z.object({ org: uuid, plan: z.enum(["essentiel", "pro", "business"]) }).safeParse(Object.fromEntries(f));
  if (!lu.success) return { erreur: "Choisissez un plan." };
  const { data, error } = await (await supabaseServeur()).rpc("changer_plan", { p_org: lu.data.org, p_plan: lu.data.plan });
  if (error) return { erreur: erreurPour(error) };
  revalidatePath(`/admin/boutiques/${lu.data.org}`);
  return {
    ok:
      data === "immediat"
        ? "Plan changé immédiatement."
        : data === "fin_de_periode"
          ? "Descente de plan : effective à la fin de la période payée."
          : "Plan inchangé.",
  };
}

export async function statutAction(_e: EtatAdmin, f: FormData): Promise<EtatAdmin> {
  await exigerRole("admin");
  const lu = z
    .object({
      org: uuid,
      action: z.enum(["suspendre", "reactiver", "annuler"]),
      jours: z.coerce.number().int().min(1).max(365).default(7),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(f));
  if (!lu.success) return { erreur: "Le nombre de jours doit être entre 1 et 365." };
  const d = lu.data;
  const { error } = await (await supabaseServeur()).rpc("admin_changer_statut", {
    p_org: d.org,
    p_action: d.action,
    p_jours: d.jours,
    p_note: d.note || null,
  });
  if (error) return { erreur: erreurPour(error) };
  revalidatePath(`/admin/boutiques/${d.org}`);
  revalidatePath("/admin/boutiques");
  revalidatePath("/admin");
  return { ok: d.action === "suspendre" ? "Boutique suspendue (lecture seule)." : d.action === "annuler" ? "Abonnement annulé." : "Boutique réactivée." };
}

export async function modifierPlanAction(_e: EtatAdmin, f: FormData): Promise<EtatAdmin> {
  await exigerRole("admin");
  const lu = z
    .object({
      code: z.enum(["essentiel", "pro", "business"]),
      prix: z.coerce.number().int().min(0).max(10_000_000),
      visible: z.string().optional(),
    })
    .safeParse(Object.fromEntries(f));
  if (!lu.success) return { erreur: "Prix invalide." };
  const { error } = await (await supabaseServeur()).rpc("admin_modifier_plan", {
    p_code: lu.data.code,
    p_prix: lu.data.prix,
    p_visible: lu.data.visible === "on",
  });
  if (error) return { erreur: erreurPour(error) };
  revalidatePath("/admin/plans");
  revalidatePath("/tarifs");
  revalidatePath("/");
  return { ok: "Plan enregistré." };
}

export async function decisionDemandeAction(_e: EtatAdmin, f: FormData): Promise<EtatAdmin> {
  await exigerRole("admin");
  const lu = z.object({ id: uuid, statut: z.enum(["acceptee", "refusee"]) }).safeParse(Object.fromEntries(f));
  if (!lu.success) return { erreur: MESSAGE_ERREUR };
  const { error } = await (await supabaseServeur()).rpc("admin_traiter_demande", { p_id: lu.data.id, p_statut: lu.data.statut });
  if (error) return { erreur: erreurPour(error) };
  revalidatePath("/admin/partenaires");
  revalidatePath("/admin");
  return { ok: lu.data.statut === "acceptee" ? "Demande acceptée." : "Demande refusée." };
}
