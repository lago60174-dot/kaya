import Link from "next/link";
import { Signe } from "./logo";
import { NavigationEntete } from "./navigation-entete";

export function Entete() {
  return (
    <header className="bg-brand border-goudron sticky top-0 z-40 border-b-[3px] text-goudron">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="Kaya, accueil"
          className="font-affiche flex items-center gap-2 text-4xl leading-none"
        >
          <Signe className="h-10 w-auto text-white" />
          Kaya
        </Link>
        <NavigationEntete />
      </div>
    </header>
  );
}
