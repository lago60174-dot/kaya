import { NextResponse } from "next/server";
import { enregistrerDepenseAction } from "@/server/caisse/actions";
import { validerVenteAction } from "@/server/ventes/actions";

/**
 * Envoi d'une opération gardée sur l'appareil (vente ou dépense). Mêmes droits et mêmes validations que les écrans :
 * le serveur recalcule tout, et la clé unique de chaque opération empêche tout doublon si l'envoi est répété.
 * Adresse stable : le service worker peut l'appeler en arrière-plan, application fermée.
 */
export async function POST(request: Request) {
  const origine = request.headers.get("origin");
  if (origine && origine !== new URL(request.url).origin)
    return NextResponse.json({ ok: false, erreur: "Origine refusée." }, { status: 403 });
  let corps: Record<string, unknown>;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erreur: "Requête illisible." }, { status: 400 });
  }
  const { type, ...operation } = corps;
  if (type === "depense") return NextResponse.json(await enregistrerDepenseAction(operation));
  if (type === undefined || type === "vente") return NextResponse.json(await validerVenteAction(operation));
  return NextResponse.json({ ok: false, erreur: "Type d'opération inconnu." }, { status: 400 });
}
