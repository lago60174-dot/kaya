import type { DocumentRecu } from "./document";
import {
  COLONNES_58MM,
  construireTicket,
  type LigneTicket,
  type OptionsTicket,
} from "./ticket";
import { encoderTexte, PAGE_CODE_858, type Repertoire } from "./texte";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const ALIGNEMENT = { gauche: 0, centre: 1, droite: 2 } as const;

/** Lignes vides après le reçu pour que le papier dépasse du capot et se déchire proprement. */
const AVANCE_FIN = 4;

/**
 * Commandes ESC/POS (le langage de presque toutes les imprimantes thermiques 58 mm) :
 * ESC @ initialise, ESC t choisit la page de code, ESC a aligne, ESC E met en gras,
 * GS ! agrandit, ESC d fait avancer le papier.
 */
export function encoderTicket(
  lignes: LigneTicket[],
  repertoire: Repertoire = "ascii",
): Uint8Array {
  const o: number[] = [ESC, 0x40];
  if (repertoire === "cp858") o.push(ESC, 0x74, PAGE_CODE_858);
  for (const l of lignes) {
    o.push(ESC, 0x61, ALIGNEMENT[l.alignement]);
    o.push(ESC, 0x45, l.gras ? 1 : 0);
    o.push(GS, 0x21, l.grand ? 0x01 : 0x00);
    o.push(...encoderTexte(l.texte, repertoire), LF);
  }
  o.push(ESC, 0x45, 0, GS, 0x21, 0, ESC, 0x61, 0);
  o.push(ESC, 0x64, AVANCE_FIN);
  return Uint8Array.from(o);
}

/** Reçu complet prêt à envoyer à l'imprimante. */
export function ticketEscPos(
  doc: DocumentRecu,
  options: OptionsTicket = {},
): Uint8Array {
  const repertoire = options.repertoire ?? "ascii";
  return encoderTicket(
    construireTicket(doc, {
      colonnes: options.colonnes ?? COLONNES_58MM,
      repertoire,
    }),
    repertoire,
  );
}
