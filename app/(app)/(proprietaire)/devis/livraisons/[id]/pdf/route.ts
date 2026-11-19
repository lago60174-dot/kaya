import { documentDepuisBonLivraison } from "@/lib/devis/document";
import { supabaseServeur } from "@/lib/supabase/server";
import { genererDocumentPdf } from "@/lib/ventes/pdf";
import { refuserSiPasDevis } from "@/server/devis/acces";
import { lireBon } from "@/server/devis/lecture";
import { lireImagesRecuPdf } from "@/server/images/logo";

/** PDF d'un bon de livraison (quantités seulement, aucun prix). Rôle, plan et boutique vérifiés ici. */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refus = await refuserSiPasDevis();
  if (refus) return refus;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Introuvable", { status: 404 });
  const bon = await lireBon(await supabaseServeur(), id);
  if (!bon) return new Response("Introuvable", { status: 404 });
  const pdf = await genererDocumentPdf(documentDepuisBonLivraison(bon), {
    ...(await lireImagesRecuPdf(bon.boutique)),
    date: bon.date,
  });
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Disposition": `inline; filename="${bon.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
