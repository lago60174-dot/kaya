import Link from "next/link";
import { boutonContour, boutonSombre } from "./boutons";

export function AppelFinal({ lienWhatsApp }: { lienWhatsApp: string | null }) {
  return (
    <section className="bg-brand text-goudron py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <h2 className="font-affiche max-w-[14ch] text-[clamp(3rem,8vw,6.5rem)] leading-[0.9]">
          Essayez Kaya sur votre prochaine vente.
        </h2>
        <p className="mt-6 max-w-[40ch] text-xl font-medium">
          Créez votre boutique en quelques minutes, ajoutez un produit, faites
          une vente.
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
      </div>
    </section>
  );
}
