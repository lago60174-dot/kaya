import { describe, expect, it } from "vitest";
import { documentDepuisVente } from "./document";
import { encoderTicket, ticketEscPos } from "./escpos";
import { recuExemple } from "./fixtures";

const doc = documentDepuisVente(recuExemple);
const contient = (o: Uint8Array, motif: number[]) =>
  Array.from({ length: o.length - motif.length + 1 }).some((_, i) =>
    motif.every((m, j) => o[i + j] === m),
  );

describe("ticketEscPos", () => {
  it("commence par l'initialisation ESC @ et finit par l'avance du papier", () => {
    const o = ticketEscPos(doc);
    expect(Array.from(o.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(o.slice(-3))).toEqual([0x1b, 0x64, 4]);
  });
  it("sans accents par défaut : aucune sélection de page de code, que de l'ASCII dans le texte", () => {
    const o = ticketEscPos(doc);
    expect(contient(o, [0x1b, 0x74])).toBe(false);
    const texte = Buffer.from(o).toString("latin1");
    expect(texte).toContain("Recu R-2026-000123");
    expect(texte).toContain("10 500 FCFA");
  });
  it("avec accents : choisit la page 858 (ESC t 19) et écrit les accents sur un octet", () => {
    const o = ticketEscPos(doc, { repertoire: "cp858" });
    expect(Array.from(o.slice(2, 5))).toEqual([0x1b, 0x74, 19]);
    expect(contient(o, [0x52, 0x65, 0x87, 0x75, 0x20, 0x52])).toBe(true); // « Reçu R »
  });
  it("règle alignement, gras et double hauteur ligne par ligne", () => {
    const o = encoderTicket([
      { texte: "A", alignement: "centre", gras: true, grand: true },
    ]);
    expect(contient(o, [0x1b, 0x61, 1])).toBe(true);
    expect(contient(o, [0x1b, 0x45, 1])).toBe(true);
    expect(contient(o, [0x1d, 0x21, 1])).toBe(true);
    // puis tout est remis à zéro en fin de reçu
    expect(Array.from(o.slice(-12, -3))).toEqual([
      0x1b, 0x45, 0, 0x1d, 0x21, 0, 0x1b, 0x61, 0,
    ]);
  });
  it("reste petit : un reçu tient dans quelques centaines d'octets", () => {
    expect(ticketEscPos(doc).length).toBeLessThan(1200);
  });
});
