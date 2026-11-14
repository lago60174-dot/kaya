import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { envPublic } from "@/lib/env";
import { zonePourChemin } from "@/lib/permissions";

/**
 * Rafraîchit la session Supabase et renvoie les visiteurs non connectés vers /connexion.
 * Contrôle de premier niveau seulement : les rôles sont vérifiés dans les pages, les actions et la RLS.
 */
export async function proxy(request: NextRequest) {
  const env = envPublic();
  let reponse = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (liste) => {
          liste.forEach(({ name, value }) => request.cookies.set(name, value));
          reponse = NextResponse.next({ request });
          liste.forEach(({ name, value, options }) =>
            reponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && zonePourChemin(request.nextUrl.pathname) !== "public") {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return reponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico)$).*)",
  ],
};
