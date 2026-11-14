import { z } from "zod";
import { lienWhatsApp, numeroWhatsApp } from "@/lib/ventes/whatsapp";

export const MESSAGE_ACCUEIL =
  "Bonjour, je voudrais en savoir plus sur Kaya pour ma quincaillerie.";

/** Adresse publique du site (sans « / » final). Null tant que NEXT_PUBLIC_APP_URL n'est pas renseignée. */
export function urlSite(): string | null {
  const brut = process.env.NEXT_PUBLIC_APP_URL;
  const lu = z.url().safeParse(brut);
  return lu.success ? lu.data.replace(/\/+$/, "") : null;
}

/** Numéro WhatsApp de Kaya (format wa.me). Null tant que NEXT_PUBLIC_WHATSAPP_NUMBER n'est pas renseigné. */
export function numeroContact(): string | null {
  return numeroWhatsApp(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
}

/** Lien WhatsApp vers Kaya avec un message prérempli. Null sans numéro : aucun bouton ne mène vers un numéro inventé. */
export function lienContact(message: string = MESSAGE_ACCUEIL): string | null {
  const numero = numeroContact();
  return numero ? lienWhatsApp(numero, message) : null;
}
