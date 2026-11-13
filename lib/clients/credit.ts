export interface CreanceOuverte {
  id: string;
  numeroRecu: string;
  /** Date de la vente (ISO). */
  date: string;
  solde: number;
}

export interface PartPaiement {
  creanceId: string;
  numeroRecu: string;
  montant: number;
  soldeApres: number;
}

export type Repartition =
  | { ok: true; parts: PartPaiement[]; detteApres: number }
  | { ok: false; erreur: string };

/**
 * Aperçu de la répartition d'un paiement : les plus anciennes dettes d'abord (même règle et même départage que la base).
 * La base fait foi : cet aperçu sert seulement à montrer au vendeur ce qui sera soldé.
 */
export function repartirFifo(
  creances: CreanceOuverte[],
  montant: number,
): Repartition {
  const total = creances.reduce((s, c) => s + c.solde, 0);
  if (!Number.isInteger(montant) || montant <= 0)
    return { ok: false, erreur: "Le montant doit être supérieur à zéro." };
  if (total === 0) return { ok: false, erreur: "Ce client ne doit rien." };
  if (montant > total)
    return { ok: false, erreur: "Le montant dépasse ce que le client doit." };
  const ordre = [...creances].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const parts: PartPaiement[] = [];
  let reste = montant;
  for (const c of ordre) {
    if (reste === 0) break;
    const part = Math.min(c.solde, reste);
    parts.push({
      creanceId: c.id,
      numeroRecu: c.numeroRecu,
      montant: part,
      soldeApres: c.solde - part,
    });
    reste -= part;
  }
  return { ok: true, parts, detteApres: total - montant };
}

/** Jour calendaire à Douala (AAAA-MM-JJ). */
function jourDouala(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(
    date,
  );
}

/** Nombre de jours entiers (calendrier de Douala) depuis une date. Jamais négatif. */
export function ancienneteJours(
  dateIso: string,
  maintenant: Date = new Date(),
): number {
  const t = (jour: string) => Date.parse(`${jour}T00:00:00Z`);
  return Math.max(
    0,
    Math.round(
      (t(jourDouala(maintenant)) - t(jourDouala(new Date(dateIso)))) /
        86_400_000,
    ),
  );
}

export function libelleAnciennete(jours: number): string {
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "depuis hier";
  if (jours < 30) return `depuis ${jours} jours`;
  if (jours < 365) return `depuis ${Math.floor(jours / 30)} mois`;
  return "depuis plus d'un an";
}

/** Une dette ancienne est à relancer en priorité : au-delà de 30 jours, on la met en évidence. */
export const detteAncienne = (jours: number) => jours >= 30;
