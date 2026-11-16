import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServeur } from "@/lib/supabase/server";

/** Une adresse de retour doit rester dans l'application : jamais de redirection vers un autre site. */
function suivantSur(brut: string | null): string {
  return brut && brut.startsWith("/") && !brut.startsWith("//") ? brut : "/";
}

/**
 * Ouverture d'un lien reçu par email (confirmation d'adresse ou mot de passe oublié).
 * Le jeton est vérifié par Supabase ; en cas de succès l'utilisateur est connecté, puis redirigé.
 */
export async function GET(requete: NextRequest) {
  const p = requete.nextUrl.searchParams;
  const type = p.get("type");
  const jeton = p.get("token_hash");
  const origine = requete.nextUrl.origin;
  if ((type !== "magiclink" && type !== "recovery") || !jeton)
    return NextResponse.redirect(new URL("/connexion?lien=invalide", origine));

  const supabase = await supabaseServeur();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: jeton,
  });
  if (error || !data.user)
    return NextResponse.redirect(new URL("/connexion?lien=invalide", origine));

  if (type === "magiclink")
    await supabaseAdmin().auth.admin.updateUserById(data.user.id, {
      app_metadata: { email_verifie: true },
    });
  return NextResponse.redirect(new URL(suivantSur(p.get("suivant")), origine));
}
