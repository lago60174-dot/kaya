import type { Metadata } from "next";
import { EcranVenteHorsLigne } from "@/components/hors-ligne/ecran-vente-hors-ligne";
import { EtatConnexion } from "@/components/hors-ligne/etat-connexion";

export const metadata: Metadata = { title: "Vente hors ligne · Kaya", robots: { index: false } };

/** Page sans donnée privée dans son HTML : elle peut donc être gardée par l'appareil. Les produits viennent d'IndexedDB. */
export default function VenteHorsLigne() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 pb-40">
      <h1 className="text-xl font-bold">Kaya · Vente hors ligne</h1>
      <EtatConnexion retourVente />
      <EcranVenteHorsLigne />
      {/* Rechargement complet voulu pour retrouver l'application normale. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/vente" className="text-sm font-bold underline">
        Retour à Kaya
      </a>
    </main>
  );
}
