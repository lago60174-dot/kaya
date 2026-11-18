"use server";

import { redirect } from "next/navigation";
import { accueilPour, menuPour } from "@/lib/permissions";
import { exigerRole } from "@/server/auth/session";
import { poserBoutiqueChoisie } from "./cookie";

/**
 * Change de boutique et reste dans la même section (Stock, Caisse…). Une page de détail propre à l'ancienne boutique
 * (un reçu par exemple) ne s'ouvrirait pas dans la nouvelle : on revient alors à la liste de la section.
 * Seul un choix parmi les boutiques accessibles est retenu ; la base refuse de toute façon les autres.
 */
export async function choisirBoutiqueAction(
  boutiqueId: string,
  chemin: string,
): Promise<void> {
  const profil = await exigerRole("boutique");
  if (!profil.boutiqueIds.includes(boutiqueId) || !profil.role || !profil.plan)
    return;
  await poserBoutiqueChoisie(boutiqueId);
  const section = `/${chemin.split("?")[0].split("/")[1] ?? ""}`;
  const permise = menuPour(profil.role, profil.plan).some(
    (m) => m.href === section,
  );
  redirect(permise ? section : accueilPour(profil.role));
}
