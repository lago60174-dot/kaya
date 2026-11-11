export interface SuggestionUnite {
  nom: string;
  facteur: number;
}

const SUGGESTIONS: Record<string, SuggestionUnite[]> = {
  kg: [
    { nom: "sac de 50 kg", facteur: 50 },
    { nom: "sac de 25 kg", facteur: 25 },
    { nom: "sac de 10 kg", facteur: 10 },
    { nom: "sac de 5 kg", facteur: 5 },
    { nom: "kg", facteur: 1 },
  ],
  mètre: [
    { nom: "rouleau de 100 m", facteur: 100 },
    { nom: "rouleau de 50 m", facteur: 50 },
    { nom: "mètre", facteur: 1 },
  ],
  litre: [
    { nom: "bidon de 20 L", facteur: 20 },
    { nom: "bidon de 5 L", facteur: 5 },
    { nom: "litre", facteur: 1 },
  ],
  pot: [
    { nom: "seau de 4 pots", facteur: 4 },
    { nom: "pot", facteur: 1 },
  ],
  pièce: [
    { nom: "carton de 100", facteur: 100 },
    { nom: "carton de 24", facteur: 24 },
    { nom: "carton de 12", facteur: 12 },
    { nom: "carton de 10", facteur: 10 },
    { nom: "pièce", facteur: 1 },
  ],
  barre: [
    { nom: "paquet de 10 barres", facteur: 10 },
    { nom: "barre", facteur: 1 },
  ],
};

const sansAccent = (t: string) =>
  t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Conditionnements courants pour une unité de base : un produit peut se vendre en sac de 50 kg, de 25 kg, au kg... */
export function suggestionsUnites(uniteBase: string): SuggestionUnite[] {
  const cle = sansAccent(uniteBase);
  const trouve = Object.entries(SUGGESTIONS).find(
    ([k]) => sansAccent(k) === cle,
  );
  return trouve
    ? trouve[1]
    : [{ nom: uniteBase.trim(), facteur: 1 }].filter((u) => u.nom !== "");
}
