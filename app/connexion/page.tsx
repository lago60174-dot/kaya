import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormulaireConnexion } from "@/components/auth/formulaire-connexion";
import { accueilPour } from "@/lib/permissions";
import { lireSession } from "@/server/auth/session";

export const metadata = { title: "Connexion · Kaya" };

export default function PageConnexion() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-brand-strong text-3xl font-bold">Connexion</h1>
      <FormulaireConnexion />
      <p className="text-sm">
        <Link href="/mot-de-passe-oublie" className="text-brand-strong font-semibold underline">
          Mot de passe oublié ?
        </Link>
      </p>
      <p className="text-muted text-sm">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="text-brand-strong font-semibold underline"
        >
          Créer ma boutique
        </Link>
      </p>
      <Suspense fallback={null}>
        <RedirectionSiConnecte />
      </Suspense>
    </main>
  );
}

/** Un utilisateur déjà connecté n'a rien à faire ici. */
async function RedirectionSiConnecte() {
  const profil = await lireSession();
  if (profil?.role)
    redirect(
      profil.doitChangerMotDePasse ? "/mot-de-passe" : accueilPour(profil.role),
    );
  return null;
}
