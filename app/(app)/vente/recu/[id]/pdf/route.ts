import { decisionGarde } from "@/lib/permissions";
import { supabaseServeur } from "@/lib/supabase/server";
import { lireLogoPdf } from "@/server/images/logo";
import { genererRecuPdf } from "@/lib/ventes/pdf";
import { lireSession } from "@/server/auth/session";
import { lireRecu } from "@/server/ventes/lecture";

/** PDF d'un reçu pour un membre de la boutique. Une route ne passe pas par la garde des pages : on vérifie ici. */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (decisionGarde(await lireSession(), "boutique").type !== "ok")
    return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Introuvable", { status: 404 });
  const recu = await lireRecu(await supabaseServeur(), id);
  if (!recu) return new Response("Introuvable", { status: 404 });
  const pdf = await genererRecuPdf(recu, {
    logo: await lireLogoPdf(recu.boutique.logoCle),
  });
  return new Response(
    new Blob([pdf as BlobPart], { type: "application/pdf" }),
    {
      headers: {
        "Content-Disposition": `inline; filename="Recu-${recu.numeroRecu}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
