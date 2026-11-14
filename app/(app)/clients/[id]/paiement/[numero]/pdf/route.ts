import { decisionGarde } from "@/lib/permissions";
import { documentDepuisPaiement } from "@/lib/print/document";
import { genererDocumentPdf } from "@/lib/ventes/pdf";
import { supabaseServeur } from "@/lib/supabase/server";
import { lireLogoPdf } from "@/server/images/logo";
import { lireSession } from "@/server/auth/session";
import { lirePaiementCredit } from "@/server/clients/lecture";

/** PDF d'un reçu de paiement de crédit pour un membre de la boutique (une route ne passe pas par la garde des pages). */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string; numero: string }> },
) {
  const profil = await lireSession();
  if (decisionGarde(profil, "boutique").type !== "ok")
    return new Response("Non autorisé", { status: 401 });
  const { id, numero } = await params;
  const p = await lirePaiementCredit(
    await supabaseServeur(),
    id,
    profil?.boutiqueIds[0] ?? "",
    numero,
  );
  if (!p) return new Response("Introuvable", { status: 404 });
  const pdf = await genererDocumentPdf(
    documentDepuisPaiement(p, p.mentionLegale),
    { date: p.date, logo: await lireLogoPdf(p.logoCle) },
  );
  return new Response(
    new Blob([pdf as BlobPart], { type: "application/pdf" }),
    {
      headers: {
        "Content-Disposition": `inline; filename="Paiement-${p.numero}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
