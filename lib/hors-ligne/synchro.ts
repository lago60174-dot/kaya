import { listerEnAttente, mettreAJourVente, retirerVente } from "./stockage";

type Envoi = (type: string, corps: Record<string, unknown>) => Promise<{ ok: boolean; erreur?: string; venteId?: string }>;

/** Envoi par une adresse stable (pas une action serveur, dont l'identifiant change à chaque mise en ligne). Redirection = session expirée. */
export async function envoyerOperation(type: string, corps: Record<string, unknown>) {
  const reponse = await fetch("/api/hors-ligne/synchro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...corps, type }),
    credentials: "same-origin",
    redirect: "manual",
  });
  if (reponse.type === "opaqueredirect" || !reponse.ok) throw new Error("indisponible");
  return (await reponse.json()) as { ok: boolean; erreur?: string; venteId?: string };
}

/**
 * Envoie, dans l'ordre, les ventes faites sans réseau. La clé de chaque vente sert d'identifiant unique :
 * si l'envoi est répété (coupure en plein milieu), le serveur ne crée jamais de doublon.
 * Refus du serveur (stock manquant, droit refusé…) : la vente est gardée et signalée, jamais perdue.
 * Réseau coupé ou session expirée : on s'arrête et on réessaiera.
 */
export async function synchroniser(envoyer: Envoi): Promise<{ envoyees: number; refusees: number; recus: string[] }> {
  const recus: string[] = [];
  let envoyees = 0;
  let refusees = 0;
  const travail = async () => {
    for (const v of await listerEnAttente()) {
      if (v.statut !== "attente") continue;
      try {
        const r = await envoyer(v.type ?? "vente", { ...v.corps, cle: v.cle });
        if (r.ok) {
          await retirerVente(v.cle);
          envoyees++;
          if (r.venteId) recus.push(r.venteId);
        } else {
          await mettreAJourVente({ ...v, statut: "refusee", erreur: r.erreur ?? "Vente refusée." });
          refusees++;
        }
      } catch {
        return;
      }
    }
  };
  // Un seul onglet à la fois envoie les ventes.
  if (navigator.locks) {
    await navigator.locks.request("kaya-synchro", { ifAvailable: true }, async (verrou) => {
      if (verrou) await travail();
    });
  } else {
    await travail();
  }
  return { envoyees, refusees, recus };
}
