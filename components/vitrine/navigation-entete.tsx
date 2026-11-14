"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavigateur } from "@/lib/supabase/client";
import { boutonContour, boutonOrange } from "./boutons";

const LIENS = [
  ["/", "Accueil"],
  ["/#fonctionnalites", "Fonctionnalités"],
  ["/#tarifs", "Tarifs"],
  ["/#faq", "FAQ"],
];

/** Lit la session dans le navigateur : la vitrine reste servie par le CDN, sans appel serveur par visite. */
export function NavigationEntete() {
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    const supabase = supabaseNavigateur();
    supabase.auth.getSession().then(({ data }) => setConnecte(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_evenement, session) =>
      setConnecte(!!session),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <>
      <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
        {LIENS.map(([href, libelle]) => (
          <Link key={href} href={href} className="flex min-h-11 items-center font-bold text-[var(--nuit)] hover:text-[var(--kaya)]">
            {libelle}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        {connecte ? (
          <Link href="/tableau-de-bord" className={`${boutonOrange} min-h-11 px-5 text-base`}>
            Mon tableau de bord
          </Link>
        ) : (
          <>
            <Link href="/connexion" className="flex min-h-11 items-center font-bold text-[var(--nuit)] underline underline-offset-4">
              Se connecter
            </Link>
            <Link href="/#demo" className={`${boutonContour} hidden min-h-11 px-5 text-base xl:inline-flex`}>
              Voir la démo
            </Link>
            <Link href="/inscription" className={`${boutonOrange} hidden min-h-11 px-5 text-base min-[440px]:inline-flex`}>
              Créer ma boutique
            </Link>
          </>
        )}
      </div>
    </>
  );
}
