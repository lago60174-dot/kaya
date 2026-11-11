import { formatQuantite } from "@/lib/format";

const ESPACES = /[\s\u00A0\u202F]/g;

/** "2,5" ou "2.5" -> 2.5. Jusqu'à 3 décimales. Null si invalide (ou zéro quand il n'est pas permis). */
export function lireQuantite(
  texte: string,
  options: { autoriserZero?: boolean } = {},
): number | null {
  const propre = texte.replace(ESPACES, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(propre)) return null;
  const n = Number(propre);
  return n === 0 && !options.autoriserZero ? null : n;
}

/** "5 500", "5500 FCFA" -> 5500. Entiers seulement. */
export function lireMontant(texte: string): number | null {
  const propre = texte.replace(ESPACES, "").replace(/fcfa$/i, "");
  return /^\d{1,12}$/.test(propre) ? Number(propre) : null;
}

export interface UniteAffichee {
  nom: string;
  facteur: number;
}

const ABREVIATIONS = new Set([
  "kg",
  "g",
  "t",
  "l",
  "ml",
  "cl",
  "m",
  "cm",
  "mm",
  "m2",
  "m3",
]);

/** Met le premier mot au pluriel dès 2 ("sac de 50 kg" -> "sacs de 50 kg", "seau" -> "seaux"), sauf les abréviations (kg, m, L). */
function pluriel(nom: string, quantite: number): string {
  if (Math.abs(quantite) < 2) return nom;
  return nom.replace(/^\p{L}+/u, (mot) =>
    ABREVIATIONS.has(mot.toLowerCase()) || /s$/i.test(mot)
      ? mot
      : /au$/i.test(mot)
        ? `${mot}x`
        : `${mot}s`,
  );
}

/** "249 kg · 4,98 sacs" : le stock est compté en unité de base, converti dans la plus grande unité de vente. */
export function formaterStock(
  quantite: number,
  uniteBase: string,
  unites: UniteAffichee[],
): string {
  const base = `${formatQuantite(quantite)} ${pluriel(uniteBase, quantite)}`;
  const grande = [...unites]
    .filter((u) => u.facteur > 1)
    .sort((a, b) => b.facteur - a.facteur)[0];
  if (!grande) return base;
  const converti = Math.round((quantite / grande.facteur) * 1000) / 1000;
  return `${base} · ${formatQuantite(converti)} ${pluriel(grande.nom, converti)}`;
}

/** Marge d'une unité de vente (FCFA entiers) : prix de vente - coût d'achat de la quantité vendue. */
export function margeUnite(
  prixVente: number,
  facteur: number,
  prixAchatBase: number,
): number {
  return prixVente - Math.round(facteur * prixAchatBase);
}
