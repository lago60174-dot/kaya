/** Code de parrainage : 4 à 12 lettres ou chiffres, insensible à la casse. Null si invalide. */
export function normaliserCode(brut: string): string | null {
  const code = brut.replace(/\s/g, "").toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

export const COOKIE_PARRAINAGE = "kaya_parrain";
export const DUREE_COOKIE_PARRAINAGE_SECONDES = 30 * 24 * 60 * 60;
