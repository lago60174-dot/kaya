import "server-only";
import { after } from "next/server";
import { diffuserNotifications } from "./push";

/** À appeler après une action qui peut créer une alerte : l'envoi push se fait après la réponse, sans ralentir l'écran. */
export function planifierNotifications(organisationId: string | null): void {
  if (!organisationId) return;
  after(async () => {
    try {
      await diffuserNotifications(organisationId);
    } catch {
      // Une notification manquée ne doit jamais faire échouer une vente.
    }
  });
}
