import { genererRecuPdf } from "@/lib/ventes/pdf";
import { lireRecuPublic } from "@/server/ventes/lecture";

/** PDF public d'un reçu, accessible avec le jeton seulement. */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ jeton: string }> },
) {
  const recu = await lireRecuPublic((await params).jeton);
  if (!recu) return new Response("Introuvable", { status: 404 });
  const pdf = await genererRecuPdf(recu);
  return new Response(
    new Blob([pdf as BlobPart], { type: "application/pdf" }),
    {
      headers: {
        "Content-Disposition": `inline; filename="Recu-${recu.numeroRecu}.pdf"`,
        "Cache-Control": "public, max-age=60",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
