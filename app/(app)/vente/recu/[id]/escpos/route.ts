import { documentDepuisVente } from "@/lib/print/document";
import { supabaseServeur } from "@/lib/supabase/server";
import { refuserSiPasImpression, reponseEscPos } from "@/server/impression";
import { lireRecu } from "@/server/ventes/lecture";

/** Ticket ESC/POS 58 mm d'un reçu. Réservé aux plans qui incluent l'impression. */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refus = await refuserSiPasImpression();
  if (refus) return refus;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Introuvable", { status: 404 });
  const recu = await lireRecu(await supabaseServeur(), id);
  if (!recu) return new Response("Introuvable", { status: 404 });
  return reponseEscPos(documentDepuisVente(recu), requete);
}
