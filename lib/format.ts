const NBSP = "\u00A0";

/** Formate un entier FCFA : 1250000 -> "1 250 000 FCFA". Jamais de décimales. */
export function formatFcfa(montant: number): string {
  if (!Number.isInteger(montant)) {
    throw new RangeError("Un montant FCFA doit être un nombre entier.");
  }
  const signe = montant < 0 ? "-" : "";
  const chiffres = Math.abs(montant)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${signe}${chiffres}${NBSP}FCFA`;
}

/** Formate une quantité (max 3 décimales, virgule française). 0.02 -> "0,02". */
export function formatQuantite(quantite: number): string {
  const arrondi = Math.round(quantite * 1000) / 1000;
  return arrondi.toString().replace(".", ",");
}

/** "10/11/2026 14:30" en heure de Douala. */
export function formatDateHeure(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Douala",
  }).format(typeof date === "string" ? new Date(date) : date);
}
