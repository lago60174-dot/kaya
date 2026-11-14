import Link from "next/link";
import type { Plan } from "@/lib/plans";
import { prixParMois, type ProgrammePublic } from "@/lib/vitrine/offre";
import { boutonContour, boutonSombre } from "./boutons";
import { MaquetteVente } from "./maquette-vente";

export function Hero({
  plan,
  programme,
  lienWhatsApp,
}: {
  plan: Plan | undefined;
  programme: ProgrammePublic | null;
  lienWhatsApp: string | null;
}) {
  const essai =
    programme && programme.essaiJours > 0
      ? `Essai gratuit de ${programme.essaiJours} jours. `
      : "";
  return (
    <section className="bg-brand text-goudron relative z-10">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:pt-12 lg:pb-12">
        <div>
          <h1 className="font-affiche text-[clamp(3.5rem,9.5vw,7.25rem)] leading-[0.88]">
            Fini le cahier qui disparaît avec le vendeur.
          </h1>
          <p className="mt-6 max-w-[36ch] text-xl font-medium sm:text-2xl">
            Kaya compte votre stock, note vos ventes et vos crédits, et vérifie
            votre caisse. Vous voyez tout sur votre téléphone, même quand vous
            n&apos;êtes pas à la boutique.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/inscription" className={boutonSombre}>
              Essayer gratuitement
            </Link>
            {lienWhatsApp && (
              <a href={lienWhatsApp} className={boutonContour}>
                Parler sur WhatsApp
              </a>
            )}
          </div>
          {plan && (
            <p className="mt-5 max-w-[44ch] font-bold">
              {essai}
              {prixParMois(plan)} ensuite, à payer par MTN Mobile Money ou
              Orange Money.
            </p>
          )}
        </div>
        <div className="flex justify-center lg:translate-y-24 lg:justify-end">
          <MaquetteVente />
        </div>
      </div>
    </section>
  );
}
