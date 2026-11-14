import Link from "next/link";
import { boutonSombre } from "./boutons";
import { Signe } from "./logo";

export function Entete() {
  return (
    <header className="bg-brand text-goudron">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="Kaya, accueil"
          className="font-affiche flex items-center gap-2 text-4xl leading-none"
        >
          <Signe className="h-10 w-auto text-white" />
          Kaya
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-4">
          <Link
            href="/connexion"
            className="flex min-h-11 items-center font-bold underline underline-offset-4"
          >
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className={`${boutonSombre} hidden min-h-11 px-4 min-[440px]:inline-flex`}
          >
            Essayer gratuitement
          </Link>
        </nav>
      </div>
    </header>
  );
}
