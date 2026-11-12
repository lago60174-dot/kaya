import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { normaliserTelephoneCm } from "@/lib/auth/schemas";
import { libelleMode } from "./paiements";

/** "+237699123456" ou "699 12 34 56" -> "237699123456" (format attendu par wa.me). Null si invalide. */
export function numeroWhatsApp(
  telephone: string | null | undefined,
): string | null {
  const n = telephone ? normaliserTelephoneCm(telephone) : null;
  return n ? n.slice(1) : null;
}

/** Ouvre WhatsApp depuis le téléphone du vendeur, vers le client si son numéro est connu. */
export function lienWhatsApp(
  telephone: string | null | undefined,
  message: string,
): string {
  const numero = numeroWhatsApp(telephone);
  return `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(message)}`;
}

export interface RecuPourMessage {
  boutique: string;
  numero: string;
  date: string;
  annule?: boolean;
  lignes: { nom: string; quantite: number; unite: string; total: number }[];
  remise: number;
  total: number;
  paiements: { mode: string; montant: number }[];
  credit: number;
  /** Lien vers la page publique du reçu. */
  lien?: string;
}

/** Résumé du reçu pour WhatsApp (court, sans donnée sensible : ni prix d'achat ni marge). */
export function messageRecu(r: RecuPourMessage): string {
  const lignes = r.lignes.map(
    (l) =>
      `• ${formatQuantite(l.quantite)} ${l.unite} ${l.nom} : ${formatFcfa(l.total)}`,
  );
  const paye = r.paiements.reduce((s, p) => s + p.montant, 0);
  return [
    `*${r.boutique}*`,
    `Reçu ${r.numero} · ${formatDateHeure(r.date)}${r.annule ? " · ANNULÉ" : ""}`,
    "",
    ...lignes,
    ...(r.remise > 0 ? [`Remise : ${formatFcfa(r.remise)}`] : []),
    `*Total : ${formatFcfa(r.total)}*`,
    ...(r.paiements.length
      ? [
          `Payé : ${formatFcfa(paye)} (${r.paiements.map((p) => `${libelleMode(p.mode)} ${formatFcfa(p.montant)}`).join(", ")})`,
        ]
      : []),
    ...(r.credit > 0 ? [`Reste à payer : ${formatFcfa(r.credit)}`] : []),
    ...(r.lien ? ["", `Voir le reçu : ${r.lien}`] : []),
    "",
    "Merci de votre confiance !",
  ].join("\n");
}
