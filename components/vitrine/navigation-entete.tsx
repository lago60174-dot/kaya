"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavigateur } from "@/lib/supabase/client";
import { boutonSombre } from "./boutons";

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
    <nav aria-label="Principal" className="flex items-center gap-4">
      {connecte ? (
        <Link href="/tableau-de-bord" className={`${boutonSombre} min-h-11 px-4`}>
          Mon tableau de bord
        </Link>
      ) : (
        <>
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
            Créer ma boutique
          </Link>
        </>
      )}
    </nav>
  );
}
