import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { origine } from "@/server/origine";

/**
 * Lien à usage unique vers /auth/confirmer. Le jeton est fabriqué par Supabase (admin) puis envoyé par Resend :
 * pas de dépendance au courrier de Supabase, et le texte de l'email reste le nôtre, en français.
 * Ce module n'est jamais appelable depuis le navigateur : le lien connecte la personne qui le possède.
 */
export async function fabriquerLienEmail(
  email: string,
  type: "magiclink" | "recovery",
  suivant: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({
    type,
    email,
  });
  const jeton = data?.properties?.hashed_token;
  if (error || !jeton) return null;
  const base = await origine();
  return `${base}/auth/confirmer?token_hash=${encodeURIComponent(jeton)}&type=${type}&suivant=${encodeURIComponent(suivant)}`;
}
