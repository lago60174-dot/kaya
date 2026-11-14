import Link from "next/link";
import { boutonContour, boutonSombre } from "./boutons";

export function AppelFinal({ lienWhatsApp }: { lienWhatsApp: string | null }) {
  return (
    <section className="bg-brand text-goudron py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <h2 className="font-affiche max-w-[18ch] text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.92]">
          Ce soir, fermez la boutique en sachant ce qu&apos;il y a en caisse.
        </h2>
        <p className="mt-6 max-w-[40ch] text-xl font-medium">
          Créez votre boutique en quelques minutes, ajoutez un produit, faites
          une vente. Le reste suit.
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
      </div>
    </section>
  );
}
