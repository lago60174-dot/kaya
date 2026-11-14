import Link from "next/link";
import { Signe } from "./logo";

const LIENS = [
  { href: "/partenaire", libelle: "Devenir partenaire" },
  { href: "/mentions-legales", libelle: "Mentions légales" },
  { href: "/confidentialite", libelle: "Confidentialité" },
  { href: "/conditions", libelle: "Conditions d'utilisation" },
  {
    href: "/conditions-partenaires",
    libelle: "Conditions du programme partenaire",
  },
];

export function Pied({ lienWhatsApp }: { lienWhatsApp: string | null }) {
  return (
    <footer className="bg-goudron sur-sombre pt-12 pb-28 text-white sm:pb-14">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-affiche flex items-center gap-3 text-5xl leading-none">
            <Signe className="text-brand h-12 w-auto" />
            Kaya
          </p>
          <p className="text-beton mt-3 max-w-[40ch]">
            La gestion de stock, de ventes, de crédits et de caisse pour les
            quincailleries du Cameroun.
          </p>
          {lienWhatsApp && (
            <a
              href={lienWhatsApp}
              className="mt-5 inline-flex min-h-11 items-center font-bold underline underline-offset-4"
            >
              Nous écrire sur WhatsApp
            </a>
          )}
        </div>
        <nav aria-label="Informations">
          <ul className="flex flex-col">
            {LIENS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-beton flex min-h-11 items-center underline underline-offset-4"
                >
                  {l.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
