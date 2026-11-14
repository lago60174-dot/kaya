import { describe, expect, it } from "vitest";
import { couperMots, encoderTexte, normaliser, versAscii } from "./texte";

describe("versAscii", () => {
  it("retire les accents et remplace la typographie", () => {
    expect(versAscii("Reçu · Dangote — très ‘bon’ cœur…")).toBe(
      "Recu - Dangote - tres 'bon' coeur...",
    );
  });
  it("transforme les espaces insécables des montants en espaces", () => {
    expect(versAscii("10 500 FCFA")).toBe("10 500 FCFA");
  });
  it("n'envoie jamais un caractère que l'imprimante ne sait pas écrire", () => {
    expect(versAscii("Ω 10 mm → fer\nbéton")).toBe("? 10 mm ? fer beton");
    expect(/^[\x20-\x7e]*$/.test(versAscii("日本語 😀 ß"))).toBe(true);
  });
});

describe("encoderTexte", () => {
  it("écrit les accents français avec la page de code 858", () => {
    const octets = encoderTexte("é è ê à ù ç ô î É À", "cp858");
    expect(octets).toEqual([
      0x82, 0x20, 0x8a, 0x20, 0x88, 0x20, 0x85, 0x20, 0x97, 0x20, 0x87, 0x20,
      0x93, 0x20, 0x8c, 0x20, 0x90, 0x20, 0xb7,
    ]);
  });
  it("garde le × et le point médian de la page 858, remplace œ", () => {
    expect(encoderTexte("2×·", "cp858")).toEqual([0x32, 0x9e, 0xfa]);
    expect(encoderTexte("cœur", "cp858")).toEqual([
      ...Buffer.from("coeur", "latin1"),
    ]);
  });
  it("reste en ASCII pur sans accents", () => {
    const octets = encoderTexte("Reçu été", "ascii");
    expect(octets.every((o) => o >= 0x20 && o <= 0x7e)).toBe(true);
    expect(Buffer.from(octets).toString("latin1")).toBe("Recu ete");
  });
  it("un caractère = un octet, pour que le compte de colonnes soit exact", () => {
    for (const r of ["ascii", "cp858"] as const) {
      const t = "Ciment 42,5 · très « bon » – 5 000 FCFA";
      expect(encoderTexte(t, r)).toHaveLength(normaliser(t, r).length);
    }
  });
});

describe("couperMots", () => {
  it("passe à la ligne sans dépasser la largeur", () => {
    const l = couperMots("Ciment CPJ 42,5 Dangote sac de 50 kg", 16);
    expect(l.every((x) => x.length <= 16)).toBe(true);
    expect(l.join(" ")).toBe("Ciment CPJ 42,5 Dangote sac de 50 kg");
  });
  it("coupe un mot trop long et gère le vide", () => {
    expect(couperMots("A".repeat(70), 32).map((x) => x.length)).toEqual([
      32, 32, 6,
    ]);
    expect(couperMots("   ", 32)).toEqual([]);
  });
});
