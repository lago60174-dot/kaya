import "server-only";
import { accesImpression } from "@/lib/print/acces";
import type { DocumentRecu } from "@/lib/print/document";
import { ticketEscPos } from "@/lib/print/escpos";
import { lireSession } from "@/server/auth/session";

/** Réponse d'erreur si la personne ne peut pas imprimer (non connectée, mauvais rôle, plan sans impression). */
export async function refuserSiPasImpression(): Promise<Response | null> {
  const acces = accesImpression(await lireSession());
  return acces.ok
    ? null
    : new Response(acces.message, { status: acces.statut });
}

/** Ticket ESC/POS 58 mm. `?accents=1` choisit la page de code 858 (réglage de l'appareil du vendeur). */
export function reponseEscPos(doc: DocumentRecu, requete: Request): Response {
  const accents = new URL(requete.url).searchParams.get("accents") === "1";
  const octets = ticketEscPos(doc, {
    repertoire: accents ? "cp858" : "ascii",
  });
  return new Response(new Blob([octets as BlobPart]), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
