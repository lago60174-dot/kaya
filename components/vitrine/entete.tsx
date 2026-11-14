import Link from "next/link";
import { Signe } from "./logo";
import { NavigationEntete } from "./navigation-entete";

export function Entete() {
  return (
    <header className="sticky top-0 z-40 bg-[#fffaf6]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" aria-label="Kaya, accueil" className="flex items-center gap-2 text-[var(--kaya)]">
          <Signe className="h-10 w-auto" />
          <span className="leading-none">
            <span className="block text-3xl font-bold">Kaya</span>
            <span className="hidden text-xs text-[var(--nuit)] sm:block">Gérez. Vendez. Grandissez.</span>
          </span>
        </Link>
        <NavigationEntete />
      </div>
    </header>
  );
}
