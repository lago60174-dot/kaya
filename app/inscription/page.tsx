import Link from "next/link";
import { Suspense } from "react";
import { FormulaireInscription } from "@/components/auth/formulaire-inscription";
import { normaliserCode } from "@/lib/auth/parrainage";

export const metadata = { title: "Créer ma boutique · Kaya" };

type Recherche = Promise<{ code?: string }>;

export default function PageInscription({
  searchParams,
}: {
  searchParams: Recherche;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-brand-strong text-3xl font-bold">
        Créer ma boutique
      </h1>
      <Suspense fallback={<FormulaireInscription />}>
        <InscriptionAvecCode searchParams={searchParams} />
      </Suspense>
      <p className="text-muted text-sm">
        Déjà un compte ?{" "}
        <Link
          href="/connexion"
          className="text-brand-strong font-semibold underline"
        >
          Se connecter
        </Link>
      </p>
    </main>
  );
}

/** Préremplit le code de parrainage venu de l'adresse (?code=...). */
async function InscriptionAvecCode({
  searchParams,
}: {
  searchParams: Recherche;
}) {
  const { code } = await searchParams;
  return (
    <FormulaireInscription
      codeInitial={code ? (normaliserCode(code) ?? undefined) : undefined}
    />
  );
}
