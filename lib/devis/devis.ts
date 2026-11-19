import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { arrondirProduit } from "@/lib/ventes/panier";

export type StatutDevis =
  "brouillon" | "envoye" | "accepte" | "refuse" | "converti";
export type TypeDevis = "devis" | "proforma";

export const STATUTS_DEVIS: { code: StatutDevis; libelle: string }[] = [
  { code: "brouillon", libelle: "Brouillon" },
  { code: "envoye", libelle: "Envoyé" },
  { code: "accepte", libelle: "Accepté" },
  { code: "refuse", libelle: "Refusé" },
  { code: "converti", libelle: "Converti en vente" },
];

export const libelleStatutDevis = (s: string) =>
  STATUTS_DEVIS.find((x) => x.code === s)?.libelle ?? s;

export const libelleTypeDevis = (t: string) =>
  t === "proforma" ? "Proforma" : "Devis";

/** Classes du badge de statut (écran liste et fiche). */
export const COULEUR_STATUT_DEVIS: Record<StatutDevis, string> = {
  brouillon: "bg-gray-100 text-gray-700",
  envoye: "bg-sky-100 text-sky-700",
  accepte: "bg-emerald-100 text-emerald-700",
  refuse: "bg-red-100 text-red-700",
  converti: "bg-orange-100 text-orange-700",
};

export const VALIDITE_DEFAUT_JOURS = 15;

/** Jour courant à Douala, au format AAAA-MM-JJ. */
export function jourDouala(maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Douala" }).format(
    maintenant,
  );
}

/** Ajoute des jours à une date AAAA-MM-JJ (calcul en UTC : pas de décalage d'heure d'été). */
export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** « 2026-12-05 » -> « 05/12/2026 ». */
export const formatJour = (jour: string) => jour.split("-").reverse().join("/");

/** Un devis envoyé ou accepté dont la date de validité est dépassée. Information seulement : rien n'est bloqué. */
export function estExpire(
  statut: StatutDevis,
  valideJusqu: string,
  aujourdhui: string,
): boolean {
  return (
    (statut === "envoye" || statut === "accepte") && valideJusqu < aujourdhui
  );
}

/** Ce que le propriétaire peut faire selon le statut. Même règle que le déclencheur SQL (qui, lui, tranche). */
export function actionsPossibles(statut: StatutDevis) {
  return {
    modifier: statut === "brouillon",
    supprimer: statut === "brouillon",
    accepter: statut === "envoye",
    refuser: statut === "envoye" || statut === "accepte",
    convertir: statut === "accepte",
    bonLivraison: statut === "accepte",
    dupliquer: statut !== "brouillon",
    partager: statut !== "brouillon",
  };
}

export interface LigneDevisDetail {
  produitId: string;
  uniteId: string;
  nom: string;
  unite: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export interface BoutiqueDocument {
  nom: string;
  adresse: string | null;
  telephone: string | null;
  mentionLegale: string | null;
  logoCle: string | null;
  ville: string | null;
  email: string | null;
  rccm: string | null;
  niu: string | null;
  signataire: string | null;
  signatureCle: string | null;
  cachetCle: string | null;
}

export interface DevisDetail {
  id: string;
  type: TypeDevis;
  numero: string | null;
  statut: StatutDevis;
  /** Date d'envoi, ou de création pour un brouillon. */
  date: string;
  valideJusqu: string;
  sousTotal: number;
  remise: number;
  total: number;
  conditions: string | null;
  note: string | null;
  client: { id: string; nom: string; telephone: string | null } | null;
  boutique: BoutiqueDocument;
  lignes: LigneDevisDetail[];
  vente: { id: string; numeroRecu: string } | null;
  bonLivraison: { id: string; numero: string } | null;
}

export interface PrixActuel {
  prixVente: number;
  enVente: boolean;
}

export interface ChangementPrix {
  nom: string;
  unite: string;
  ancien: number;
  /** null : l'article n'est plus en vente. */
  actuel: number | null;
}

/** Lignes dont le prix du jour n'est plus celui du devis (la vente utilisera le prix du jour). */
export function changementsDePrix(
  lignes: LigneDevisDetail[],
  prix: Map<string, PrixActuel>,
): ChangementPrix[] {
  const liste: ChangementPrix[] = [];
  for (const l of lignes) {
    const p = prix.get(l.uniteId);
    if (!p || !p.enVente)
      liste.push({
        nom: l.nom,
        unite: l.unite,
        ancien: l.prixUnitaire,
        actuel: null,
      });
    else if (p.prixVente !== l.prixUnitaire)
      liste.push({
        nom: l.nom,
        unite: l.unite,
        ancien: l.prixUnitaire,
        actuel: p.prixVente,
      });
  }
  return liste;
}

/** Total que donnerait la vente aux prix du jour, remise du devis incluse. Null si un article n'est plus en vente. */
export function totalAuxPrixActuels(
  lignes: LigneDevisDetail[],
  prix: Map<string, PrixActuel>,
  remise: number,
): number | null {
  let brut = 0;
  for (const l of lignes) {
    const p = prix.get(l.uniteId);
    if (!p || !p.enVente) return null;
    brut += arrondirProduit(l.quantite, p.prixVente);
  }
  return brut - remise;
}

/** Message WhatsApp : résumé court, sans coût d'achat ni marge. */
export function messageDevis(d: DevisDetail): string {
  const lignes = d.lignes.map(
    (l) =>
      `• ${formatQuantite(l.quantite)} ${l.unite} ${l.nom} : ${formatFcfa(l.total)}`,
  );
  return [
    `*${d.boutique.nom}*`,
    `${libelleTypeDevis(d.type)} ${d.numero ?? ""} · ${formatDateHeure(d.date)}`.replace(
      "  ",
      " ",
    ),
    "",
    ...lignes,
    ...(d.remise > 0 ? [`Remise : ${formatFcfa(d.remise)}`] : []),
    `*Total : ${formatFcfa(d.total)}*`,
    `Valable jusqu'au ${formatJour(d.valideJusqu)}`,
    ...(d.conditions ? ["", `Conditions : ${d.conditions}`] : []),
    "",
    "Le PDF du devis est joint à ce message. Merci de votre confiance !",
  ].join("\n");
}
