import "server-only";
import { cookies } from "next/headers";
import { COOKIE_BOUTIQUE } from "@/lib/boutiques/active";

const UN_AN = 60 * 60 * 24 * 365;

/** Écrit le repère « boutique choisie ». Module interne (pas une action) : l'appelant a déjà vérifié le droit d'accès. */
export async function poserBoutiqueChoisie(boutiqueId: string): Promise<void> {
  (await cookies()).set(COOKIE_BOUTIQUE, boutiqueId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UN_AN,
  });
}
