import Link from "next/link";
import { FormulaireOubli } from "@/components/auth/formulaire-oubli";

export const metadata = { title: "Mot de passe oublié · Kaya" };

export default function PageMotDePasseOublie() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-brand-strong text-3xl font-bold">Mot de passe oublié</h1>
      <p>
        Saisissez l&apos;email de votre compte. Nous vous envoyons un lien pour
        choisir un nouveau mot de passe.
      </p>
      <FormulaireOubli />
      <p className="text-muted text-sm">
        <Link href="/connexion" className="text-brand-strong font-semibold underline">
          Retour à la connexion
        </Link>
      </p>
    </main>
  );
}
