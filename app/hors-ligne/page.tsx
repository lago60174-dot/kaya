import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false },
};

export default function HorsLigne() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-brand-strong text-3xl font-bold">Pas de connexion</h1>
      <p className="text-neutral-700">
        Kaya a besoin d&apos;internet pour afficher votre boutique. Vérifiez
        votre réseau puis réessayez : vos données sont en sécurité.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/hors-ligne/vente" className="min-h-11 font-bold underline">
        Vendre sans connexion
      </a>
      {/* Rechargement complet voulu : un <Link> ne referait pas la requête réseau. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="bg-brand-strong flex min-h-11 items-center rounded-xl px-6 font-bold text-white"
      >
        Réessayer
      </a>
    </main>
  );
}
