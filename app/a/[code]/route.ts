import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_PARRAINAGE,
  DUREE_COOKIE_PARRAINAGE_SECONDES,
  normaliserCode,
} from "@/lib/auth/parrainage";

/** Lien d'affilié : /a/CODE. Garde le code 30 jours (premier contact), puis envoie vers l'inscription. */
export async function GET(
  requete: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normaliserCode((await params).code);
  const reponse = NextResponse.redirect(new URL("/inscription", requete.url));
  if (code && !requete.cookies.get(COOKIE_PARRAINAGE)) {
    reponse.cookies.set(COOKIE_PARRAINAGE, code, {
      maxAge: DUREE_COOKIE_PARRAINAGE_SECONDES,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return reponse;
}
