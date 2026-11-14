import type { ReactNode } from "react";

/** Page de texte long (mentions légales, conditions...) : colonne étroite, titres de panneau. */
export function PageTexte({
  titre,
  miseAJour,
  children,
}: {
  titre: string;
  miseAJour: string;
  children: ReactNode;
}) {
  return (
    <main id="contenu">
      <section className="bg-brand tole text-goudron border-goudron border-b-[3px]">
        <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 lg:py-16">
          <h1 className="font-affiche text-[clamp(3rem,8vw,5.5rem)] leading-[0.9]">
            {titre}
          </h1>
          <p className="mt-3 font-bold">Dernière mise à jour : {miseAJour}</p>
        </div>
      </section>
      <div className="bg-white py-10 lg:py-14">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </div>
    </main>
  );
}

export function Rubrique({
  titre,
  children,
}: {
  titre: string;
  children: ReactNode;
}) {
  return (
    <section className="border-brand mt-6 flex flex-col gap-3 border-l-[10px] py-1 pl-5">
      <h2 className="font-affiche text-4xl leading-none">{titre}</h2>
      {children}
    </section>
  );
}

export const lienTexte =
  "text-brand-strong font-bold underline underline-offset-4";
