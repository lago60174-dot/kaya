import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";

export type StatutCommande = "commandee" | "recue_partiellement" | "recue" | "annulee";

export const STATUTS_COMMANDE: { code: StatutCommande; libelle: string }[] = [
  { code: "commandee", libelle: "Commandée" },
  { code: "recue_partiellement", libelle: "Reçue en partie" },
  { code: "recue", libelle: "Reçue" },
  { code: "annulee", libelle: "Annulée" },
];

export const libelleStatutCommande = (s: string) =>
  STATUTS_COMMANDE.find((x) => x.code === s)?.libelle ?? s;

export const COULEUR_STATUT_COMMANDE: Record<StatutCommande, string> = {
  commandee: "bg-sky-100 text-sky-700",
  recue_partiellement: "bg-orange-100 text-orange-700",
  recue: "bg-emerald-100 text-emerald-700",
  annulee: "bg-gray-100 text-gray-700",
};

/** Ce que le propriétaire peut faire d'une commande (la base tranche aussi). */
export function actionsCommande(statut: StatutCommande) {
  return {
    recevoir: statut === "commandee" || statut === "recue_partiellement",
    annuler: statut === "commandee",
  };
}

export interface LigneCommandeDetail {
  id: string;
  produitId: string;
  nom: string;
  unite: string;
  facteur: number;
  quantite: number;
  recue: number;
  prixAchat: number;
}

/** Quantité encore attendue pour une ligne. */
export const resteARecevoir = (l: LigneCommandeDetail) =>
  Math.round((l.quantite - l.recue) * 1000) / 1000;

export const totalLigneCommande = (quantite: number, prix: number) =>
  Math.round(quantite * prix);

/** Variation d'un prix d'achat, en pourcentage entier (arrondi). Null s'il n'y avait pas d'ancien prix. */
export function variationPrix(ancien: number | null, nouveau: number): number | null {
  if (ancien === null || ancien <= 0) return null;
  return Math.round(((nouveau - ancien) / ancien) * 100);
}

/** Message WhatsApp au fournisseur : la commande, sans aucun prix de vente. */
export function messageCommande(
  boutique: string,
  numero: string,
  lignes: { nom: string; unite: string; quantite: number }[],
  note: string | null,
  date: string,
): string {
  return [
    `Bonjour, commande ${numero} de *${boutique}* · ${formatDateHeure(date)}`,
    "",
    ...lignes.map((l) => `• ${formatQuantite(l.quantite)} ${l.unite} ${l.nom}`),
    ...(note ? ["", note] : []),
    "",
    "Merci de confirmer la disponibilité et le délai.",
  ].join("\n");
}

export const resumeDette = (montant: number, solde: number) =>
  solde === 0 ? "Soldée" : `${formatFcfa(solde)} à payer sur ${formatFcfa(montant)}`;
