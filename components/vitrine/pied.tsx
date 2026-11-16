import Link from "next/link";
import { Signe } from "./logo";

const LIENS = [
  { href: "/#fonctionnalites", libelle: "Fonctionnalités" },
  { href: "/tarifs", libelle: "Tarifs" },
  { href: "/#faq", libelle: "FAQ" },
  { href: "/partenaire", libelle: "Devenir partenaire" },
  { href: "/mentions-legales", libelle: "Mentions légales" },
  { href: "/confidentialite", libelle: "Confidentialité" },
  { href: "/conditions", libelle: "Conditions d'utilisation" },
  { href: "/conditions-partenaires", libelle: "Programme partenaire" },
];

export function Pied({ lienWhatsApp }: { lienWhatsApp: string | null }) {
  return (
    <footer className="bg-[var(--nuit)] pt-10 pb-28 text-white sm:pb-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 text-[var(--kaya)]">
          <Signe className="h-12 w-auto" />
          <span className="leading-none">
            <span className="block text-3xl font-bold">Kaya</span>
            <span className="text-sm text-white">Gérez. Vendez. Grandissez.</span>
          </span>
        </div>
        <nav aria-label="Informations">
          <ul className="flex flex-wrap gap-x-5">
            {LIENS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-11 items-center hover:underline">
                  {l.libelle}
                </Link>
              </li>
            ))}
            {lienWhatsApp && (
              <li>
                <a href={lienWhatsApp} className="flex min-h-11 items-center hover:underline">
                  Contact
                </a>
              </li>
            )}
          </ul>
        </nav>
        <p className="text-sm">© 2026 Kaya. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
