import { Suspense } from "react";
import { FormulaireMotDePasse } from "@/components/auth/formulaire-mot-de-passe";
import { exigerRole } from "@/server/auth/session";

export const metadata = { title: "Nouveau mot de passe · Kaya" };

export default function PageMotDePasse() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-brand-strong text-3xl font-bold">
        Choisissez votre mot de passe
      </h1>
      <p>
        Pour votre sécurité, remplacez le mot de passe provisoire par un mot de
        passe que vous êtes seul à connaître.
      </p>
      <Suspense fallback={null}>
        <FormulaireProtege />
      </Suspense>
    </main>
  );
}

async function FormulaireProtege() {
  await exigerRole("connecte");
  return <FormulaireMotDePasse />;
}
