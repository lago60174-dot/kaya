import { formatDateHeure, formatFcfa } from "@/lib/format";
import { libelleMode } from "@/lib/ventes/paiements";

/** "Jean Mbarga" -> "Jean". Garde le nom entier pour une entreprise ou un seul mot. */
export function prenomPourMessage(nom: string): string {
  const mots = nom.trim().split(/\s+/);
  return mots.length === 2 && /^\p{L}[\p{L}'-]*$/u.test(mots[0])
    ? mots[0]
    : nom.trim();
}

export interface DetteRappel {
  boutique: string;
  client: string;
  /** Total dû par le client. */
  dette: number;
  /** Reçus concernés (le plus ancien d'abord). */
  recus?: string[];
}

/** Rappel courtois, sans pression ni reproche : le client garde la face, le patron récupère son argent. */
export function messageRappel(d: DetteRappel): string {
  const recus = d.recus?.length
    ? ` (${d.recus.length > 3 ? `${d.recus.slice(0, 3).join(", ")}…` : d.recus.join(", ")})`
    : "";
  return [
    `Bonjour ${prenomPourMessage(d.client)},`,
    "",
    `C'est ${d.boutique}. Petit rappel amical : il vous reste ${formatFcfa(d.dette)} à régler chez nous${recus}.`,
    "",
    "Pouvez-vous passer quand ça vous arrange, ou payer par Mobile Money ? Dites-moi simplement ce qui vous convient.",
    "",
    "Merci beaucoup, et bonne journée !",
  ].join("\n");
}

export interface PaiementRecu {
  boutique: string;
  numero: string;
  date: string;
  client: string;
  montant: number;
  mode: string;
  repartition: {
    numeroRecuVente: string;
    montant: number;
    soldeApres: number;
  }[];
  detteRestante: number;
}

/** Reçu de paiement pour WhatsApp : ce qui a été payé, sur quelles ventes, et ce qu'il reste à devoir. */
export function messagePaiement(p: PaiementRecu, lien?: string): string {
  return [
    `*${p.boutique}*`,
    `Reçu de paiement ${p.numero} · ${formatDateHeure(p.date)}`,
    "",
    `Bonjour ${prenomPourMessage(p.client)}, nous avons bien reçu ${formatFcfa(p.montant)} (${libelleMode(p.mode)}). Merci !`,
    ...p.repartition.map(
      (r) =>
        `• ${r.numeroRecuVente} : ${formatFcfa(r.montant)}${r.soldeApres === 0 ? " (soldé)" : ` (reste ${formatFcfa(r.soldeApres)})`}`,
    ),
    p.detteRestante > 0
      ? `*Il vous reste ${formatFcfa(p.detteRestante)} à régler.*`
      : "*Vous ne devez plus rien. Merci de votre confiance !*",
    ...(lien ? ["", lien] : []),
  ].join("\n");
}
