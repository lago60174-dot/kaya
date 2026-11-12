import "server-only";
import { headers } from "next/headers";

/** Adresse publique de l'application, pour les liens partagés (reçus). NEXT_PUBLIC_APP_URL est prioritaire. */
export async function origine(): Promise<string> {
  const configuree = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configuree) return configuree;
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocole =
    h.get("x-forwarded-proto") ??
    (hote.startsWith("localhost") ? "http" : "https");
  return `${protocole}://${hote}`;
}
