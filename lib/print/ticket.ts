import type { DocumentRecu } from "./document";
import { couperMots, normaliser, type Repertoire } from "./texte";

/** 58 mm = 32 colonnes en police standard (80 mm = 48). */
export const COLONNES_58MM = 32;

export interface LigneTicket {
  texte: string;
  alignement: "gauche" | "centre" | "droite";
  gras: boolean;
  /** Double hauteur (la largeur ne change pas : le compte de colonnes reste vrai). */
  grand: boolean;
}

export interface OptionsTicket {
  colonnes?: number;
  repertoire?: Repertoire;
}

/**
 * Met en page un reçu pour une imprimante thermique : chaque ligne tient dans `colonnes`, sans exception.
 * Fonction pure : le résultat se teste ligne par ligne, sans imprimante.
 */
export function construireTicket(
  doc: DocumentRecu,
  options: OptionsTicket = {},
): LigneTicket[] {
  const colonnes = options.colonnes ?? COLONNES_58MM;
  const repertoire = options.repertoire ?? "ascii";
  const lignes: LigneTicket[] = [];
  const n = (t: string) => normaliser(t, repertoire);

  const texte = (
    t: string,
    o: Partial<Omit<LigneTicket, "texte">> = {},
  ): void => {
    for (const l of couperMots(n(t), colonnes))
      lignes.push({
        texte: l,
        alignement: o.alignement ?? "gauche",
        gras: o.gras ?? false,
        grand: o.grand ?? false,
      });
  };
  const separateur = () => lignes.push(ligne("-".repeat(colonnes)));
  const vide = () => lignes.push(ligne(""));
  /** Libellé à gauche (peut passer à la ligne) et montant collé à droite sur la première ligne. */
  const deuxColonnes = (
    gauche: string,
    droite: string,
    o: { gras?: boolean; grand?: boolean } = {},
  ): void => {
    const d = n(droite);
    const g = n(gauche);
    const place = d ? Math.max(1, colonnes - d.length - 1) : colonnes;
    const parties = couperMots(g, place);
    if (parties.length === 0) parties.push("");
    parties.forEach((p, i) => {
      const remplissage =
        i === 0 && d
          ? " ".repeat(Math.max(1, colonnes - p.length - d.length))
          : "";
      lignes.push({
        texte: i === 0 ? `${p}${remplissage}${d}` : p,
        alignement: "gauche",
        gras: o.gras ?? false,
        grand: o.grand ?? false,
      });
    });
  };

  texte(doc.boutique.nom, { alignement: "centre", gras: true, grand: true });
  if (doc.boutique.adresse)
    texte(doc.boutique.adresse, { alignement: "centre" });
  if (doc.boutique.telephone)
    texte(`Tel. ${doc.boutique.telephone}`, { alignement: "centre" });
  separateur();
  texte(doc.titre, { gras: true });
  texte(doc.date);
  if (doc.client) texte(`Client : ${doc.client}`);
  if (doc.precision) texte(doc.precision);
  if (doc.annule) {
    vide();
    texte("*** ANNULE ***", { alignement: "centre", gras: true, grand: true });
  }
  separateur();

  for (const l of doc.lignes) {
    deuxColonnes(l.designation, l.montant, { gras: true });
    if (l.detail) texte(`  ${l.detail}`);
  }
  separateur();

  for (const t of doc.totaux) {
    deuxColonnes(t.libelle, t.montant, {
      gras: t.niveau === "majeur" || t.niveau === "fort",
      grand: t.niveau === "majeur",
    });
  }
  if (doc.mentionLegale) {
    vide();
    texte(doc.mentionLegale, { alignement: "centre" });
  }
  vide();
  texte(doc.remerciement, { alignement: "centre" });
  return lignes;
}

function ligne(texte: string): LigneTicket {
  return { texte, alignement: "gauche", gras: false, grand: false };
}
