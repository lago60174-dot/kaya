import "server-only";
import { redirect } from "next/navigation";
import { peutUtiliser } from "@/lib/plans";
import { exigerRole } from "@/server/auth/session";

/** Pages et actions des fournisseurs : propriétaire d'un plan qui les inclut (la base vérifie aussi). */
export async function exigerFournisseurs() {
  const profil = await exigerRole("proprietaire");
  if (!profil.plan || !peutUtiliser(profil.plan, "fournisseurs")) redirect("/patron");
  return { profil, boutiqueId: profil.boutiqueIds[0] ?? null };
}
