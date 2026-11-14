import Link from "next/link";
import type { Plan } from "@/lib/plans";
import { prixParMois } from "@/lib/vitrine/offre";
import { boutonContour, boutonSombre } from "./boutons";
import { MaquetteVente } from "./maquette-vente";

export function Hero({
  plan,
  lienWhatsApp,
}: {
  plan: Plan | undefined;
  lienWhatsApp: string | null;
}) {
  return (
    <section className="bg-brand tole text-goudron relative z-10">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:pt-12 lg:pb-12">
        <div>
          <h1 className="font-affiche text-[clamp(3.5rem,9.5vw,7.25rem)] leading-[0.88]">
            Fini le cahier qui disparaît avec le vendeur.
          </h1>
          <p className="mt-6 max-w-[36ch] text-xl font-medium sm:text-2xl">
            Ciment au sac, fer à la barre, clous au kilo : Kaya tient le stock, les ventes, les crédits et la caisse de votre quincaillerie. Vous voyez tout sur votre téléphone, même au chantier.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/inscription" className={boutonSombre}>
              Créer ma boutique
            </Link>
            {lienWhatsApp && (
              <a href={lienWhatsApp} className={boutonContour}>
                Parler sur WhatsApp
              </a>
            )}
          </div>
          {plan && (
            <p className="mt-5 max-w-[44ch] font-bold">
              {prixParMois(plan)}, à payer par MTN Mobile Money ou Orange
              Money.
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
