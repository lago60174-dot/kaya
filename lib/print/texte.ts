/**
 * Une imprimante thermique lit des octets, pas de l'UTF-8. Deux répertoires :
 * - `ascii` : aucun accent, lisible sur toutes les imprimantes (choix par défaut) ;
 * - `cp858` : accents français, si la page de code 858 de l'imprimante est active (réglage par appareil).
 */
export type Repertoire = "ascii" | "cp858";

const REMPLACEMENTS: Record<string, string> = {
  œ: "oe",
  Œ: "OE",
  "‘": "'",
  "’": "'",
  "‛": "'",
  "“": '"',
  "”": '"',
  "«": '"',
  "»": '"',
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  "×": "x",
  "·": "-",
  "°": "o",
  "€": "EUR",
};

/** Octets de la page de code 858 (PC850 + euro) pour les caractères utiles en français. */
const CP858: Record<string, number> = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  É: 0x90,
  ô: 0x93,
  ö: 0x94,
  û: 0x96,
  ù: 0x97,
  "×": 0x9e,
  À: 0xb7,
  Â: 0xb6,
  Ê: 0xd2,
  Ë: 0xd3,
  È: 0xd4,
  "€": 0xd5,
  Î: 0xd7,
  Ï: 0xd8,
  Ô: 0xe2,
  Ù: 0xeb,
  Û: 0xea,
  "°": 0xf8,
  "·": 0xfa,
};

/** Numéro de page de code pour la commande ESC t. */
export const PAGE_CODE_858 = 19;

const estAscii = (c: string) => c >= " " && c <= "~";

/** Sans accent : « é » devient « e ». Tout ce qui reste hors ASCII devient « ? » (jamais de caractère illisible). */
export function versAscii(texte: string): string {
  let sortie = "";
  for (const c of texte.replace(/[\r\n\t]+/g, " ")) {
    if (estAscii(c)) sortie += c;
    else if (/\s/.test(c))
      sortie += " "; // espaces insécables et fines des montants
    else if (c in REMPLACEMENTS) sortie += REMPLACEMENTS[c];
    else {
      const base = c.normalize("NFD").replace(/\p{M}/gu, "");
      sortie += base.length > 0 && [...base].every(estAscii) ? base : "?";
    }
  }
  return sortie;
}

/**
 * Texte réduit aux caractères que le répertoire sait écrire. À appeler AVANT de couper les lignes :
 * chaque caractère obtenu occupe exactement une colonne et un octet.
 */
export function normaliser(texte: string, repertoire: Repertoire): string {
  if (repertoire === "ascii") return versAscii(texte);
  let sortie = "";
  for (const c of texte.replace(/[\r\n\t]+/g, " ")) {
    if (estAscii(c) || c in CP858) sortie += c;
    else if (/\s/.test(c)) sortie += " ";
    else sortie += versAscii(c);
  }
  return sortie;
}

/** Octets du texte (déjà normalisé) dans le répertoire choisi. */
export function encoderTexte(texte: string, repertoire: Repertoire): number[] {
  const octets: number[] = [];
  for (const c of normaliser(texte, repertoire)) {
    octets.push(estAscii(c) ? c.charCodeAt(0) : (CP858[c] ?? 0x3f));
  }
  return octets;
}

/** Coupe aux espaces pour tenir dans `largeur` colonnes ; un mot trop long est coupé. */
export function couperMots(texte: string, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= largeur) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    let reste = mot;
    while (reste.length > largeur) {
      lignes.push(reste.slice(0, largeur));
      reste = reste.slice(largeur);
    }
    courante = reste;
  }
  if (courante) lignes.push(courante);
  return lignes;
}
