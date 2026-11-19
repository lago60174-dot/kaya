import { documentDepuisDevis } from "@/lib/devis/document";
import { supabaseServeur } from "@/lib/supabase/server";
import { genererDocumentPdf } from "@/lib/ventes/pdf";
import { refuserSiPasDevis } from "@/server/devis/acces";
import { lireDevis } from "@/server/devis/lecture";
import { lireImagesRecuPdf } from "@/server/images/logo";

/** PDF d'un devis envoyé. Une route ne passe pas par la garde des pages : on vérifie ici (rôle, plan, boutique). */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refus = await refuserSiPasDevis();
  if (refus) return refus;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Introuvable", { status: 404 });
  const devis = await lireDevis(await supabaseServeur(), id);
  if (!devis || !devis.numero)
    return new Response("Introuvable", { status: 404 });
  const pdf = await genererDocumentPdf(
    documentDepuisDevis(devis),
    { ...(await lireImagesRecuPdf(devis.boutique)), date: devis.date },
  );
  return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Disposition": `inline; filename="${devis.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
