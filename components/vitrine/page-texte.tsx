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
    <main id="contenu" className="bg-white py-12 lg:py-20">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <h1 className="font-affiche text-[clamp(3rem,8vw,5.5rem)] leading-[0.9]">
          {titre}
        </h1>
        <p className="text-terre mt-3">Dernière mise à jour : {miseAJour}</p>
        <div className="mt-8 flex flex-col gap-4">{children}</div>
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
    <section className="border-goudron mt-6 flex flex-col gap-3 border-t-2 pt-6">
      <h2 className="font-affiche text-4xl leading-none">{titre}</h2>
      {children}
    </section>
  );
}

export const lienTexte =
  "text-brand-strong font-bold underline underline-offset-4";
