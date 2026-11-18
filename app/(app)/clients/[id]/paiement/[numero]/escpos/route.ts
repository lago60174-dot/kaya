import { documentDepuisPaiement } from "@/lib/print/document";
import { supabaseServeur } from "@/lib/supabase/server";
import { lireSession } from "@/server/auth/session";
import { lirePaiementCredit } from "@/server/clients/lecture";
import { refuserSiPasImpression, reponseEscPos } from "@/server/impression";

/** Ticket ESC/POS 58 mm d'un reçu de paiement de crédit. Réservé aux plans qui incluent l'impression. */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string; numero: string }> },
) {
  const refus = await refuserSiPasImpression();
  if (refus) return refus;
  const { id, numero } = await params;
  const profil = await lireSession();
  const p = await lirePaiementCredit(
    await supabaseServeur(),
    id,
    profil?.boutiqueActiveId ?? "",
    numero,
  );
  if (!p) return new Response("Introuvable", { status: 404 });
  return reponseEscPos(documentDepuisPaiement(p, p.mentionLegale), requete);
}
