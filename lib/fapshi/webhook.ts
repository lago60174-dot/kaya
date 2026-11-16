import { z } from "zod";
import { STATUTS_FAPSHI } from "./client";

/** Comparaison en temps constant (hachage SHA-256 des deux valeurs : même longueur, pas de fuite par le temps). */
export async function secretsEgaux(
  recu: string | null,
  attendu: string,
): Promise<boolean> {
  if (!recu) return false;
  const h = async (v: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    );
  const [a, b] = await Promise.all([h(recu), h(attendu)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const payload = z.object({
  transId: z.string().min(1).max(100),
  status: z.enum(STATUTS_FAPSHI),
  externalId: z.string().min(1).max(100).nullish(),
  amount: z.coerce.number().int().optional(),
});
export type NotificationFapshi = z.infer<typeof payload>;

/** Valide le corps reçu. Il n'est jamais cru : l'état est relu chez Fapshi avant tout effet. */
export function lireNotification(corps: unknown): NotificationFapshi | null {
  const r = payload.safeParse(corps);
  return r.success ? r.data : null;
}
