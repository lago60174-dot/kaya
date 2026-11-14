import { redirect } from "next/navigation";
import { accueilPour } from "@/lib/permissions";
import { lireSession } from "@/server/auth/session";

export const metadata = { title: "Mon tableau de bord · Kaya" };

/** Porte d'entrée depuis la vitrine : chacun arrive sur son écran (patron, vendeur, admin...). */
export default async function TableauDeBord() {
  const profil = await lireSession();
  if (!profil?.role) redirect("/connexion");
  redirect(
    profil.doitChangerMotDePasse ? "/mot-de-passe" : accueilPour(profil.role),
  );
}
