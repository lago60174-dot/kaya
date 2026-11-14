import type { Role } from "@/lib/permissions";

/** Résumé d'une journée, tel que calculé par la base (`calculer_caisse`). Tous les montants sont des FCFA entiers. */
export interface ResumeCaisse {
  ventesTotal: number;
  nbVentes: number;
  creditAccorde: number;
  encaissementsEspeces: number;
  remboursementsCreditEspeces: number;
  mtnMomo: number;
  orangeMoney: number;
  mtnMomoRembourse: number;
  orangeMoneyRembourse: number;
  depensesTotal: number;
  depensesEspeces: number;
  avoirsEspeces: number;
  especesAttendues: number;
}

/** Espèces attendues = encaissements + remboursements de crédit - dépenses payées en espèces - avoirs remboursés en espèces. */
export function especesAttendues(
  c: Pick<
    ResumeCaisse,
    | "encaissementsEspeces"
    | "remboursementsCreditEspeces"
    | "depensesEspeces"
    | "avoirsEspeces"
  >,
): number {
  return (
    c.encaissementsEspeces +
    c.remboursementsCreditEspeces -
    c.depensesEspeces -
    c.avoirsEspeces
  );
}

/** Écart = compté - attendu. Négatif : il manque de l'argent. Positif : il y en a en trop. */
export function calculerEcart(attendu: number, compte: number): number {
  return compte - attendu;
}

export interface JugementEcart {
  niveau: "juste" | "tolere" | "alerte";
  message: string;
}

/** Interprète un écart au regard de la tolérance fixée par le propriétaire. L'alerte se déclenche au-delà de la tolérance (même règle que la base). */
export function jugerEcart(
  ecart: number,
  tolerance: number,
  formater: (n: number) => string,
): JugementEcart {
  if (ecart === 0)
    return { niveau: "juste", message: "La caisse est juste. Bravo !" };
  const sens =
    ecart < 0
      ? `Il manque ${formater(-ecart)} dans la caisse.`
      : `Il y a ${formater(ecart)} en trop dans la caisse.`;
  if (Math.abs(ecart) > tolerance)
    return {
      niveau: "alerte",
      message: `${sens} Le propriétaire sera prévenu.`,
    };
  return { niveau: "tolere", message: `${sens} C'est dans la marge admise.` };
}

const FUSEAU = "Africa/Douala";

/** Jour (AAAA-MM-JJ) en heure de Douala. */
export function jourDouala(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU }).format(date);
}

const MOTIF_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vrai pour un vrai jour du calendrier (le 2026-02-30 est refusé). */
export function estJourValide(jour: string): boolean {
  const m = MOTIF_JOUR.exec(jour);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  );
}

/** Décale un jour AAAA-MM-JJ (calcul en UTC : pas d'heure d'été au Cameroun, aucun piège de fuseau). */
export function decalerJour(jour: string, nbJours: number): string {
  const m = MOTIF_JOUR.exec(jour);
  if (!m || !estJourValide(jour)) throw new RangeError("Jour invalide.");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + nbJours));
  return d.toISOString().slice(0, 10);
}

/** Bornes [début, fin[ d'un jour de Douala (UTC+1) pour filtrer des dates horodatées. */
export function bornesJour(jour: string): { debut: string; fin: string } {
  if (!estJourValide(jour)) throw new RangeError("Jour invalide.");
  return {
    debut: `${jour}T00:00:00+01:00`,
    fin: `${decalerJour(jour, 1)}T00:00:00+01:00`,
  };
}

/** Jour demandé dans l'adresse, ramené à une valeur sûre : jamais dans le futur, jamais invalide. */
export function jourDemande(
  param: string | undefined,
  aujourdhui: string,
): string {
  if (!param || !estJourValide(param)) return aujourdhui;
  return param > aujourdhui ? aujourdhui : param;
}

export function libelleJour(jour: string, aujourdhui: string): string {
  if (jour === aujourdhui) return "Aujourd'hui";
  if (jour === decalerJour(aujourdhui, -1)) return "Hier";
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a}`;
}

export type CategorieDepense =
  "transport" | "electricite" | "salaire" | "autre";

export const CATEGORIES_DEPENSE: { code: CategorieDepense; libelle: string }[] =
  [
    { code: "transport", libelle: "Transport" },
    { code: "electricite", libelle: "Électricité" },
    { code: "salaire", libelle: "Salaire" },
    { code: "autre", libelle: "Autre" },
  ];

export const libelleCategorie = (code: string) =>
  CATEGORIES_DEPENSE.find((c) => c.code === code)?.libelle ?? code;

/** Un vendeur saisit ses dépenses simples ; le salaire est réservé au propriétaire (la base l'impose aussi). */
export function categoriesPour(role: Role) {
  return role === "proprietaire"
    ? CATEGORIES_DEPENSE
    : CATEGORIES_DEPENSE.filter((c) => c.code !== "salaire");
}

export const MONTANT_MAX = 100_000_000;
