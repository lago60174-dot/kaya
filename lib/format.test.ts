import { describe, expect, it } from "vitest";
import { formatDateHeure, formatFcfa, formatQuantite } from "./format";

describe("formatFcfa", () => {
  it("sépare les milliers par des espaces", () => {
    expect(formatFcfa(1250000)).toBe("1\u00A0250\u00A0000\u00A0FCFA");
  });
  it("gère zéro et les petits montants", () => {
    expect(formatFcfa(0)).toBe("0\u00A0FCFA");
    expect(formatFcfa(500)).toBe("500\u00A0FCFA");
  });
  it("gère les montants négatifs", () => {
    expect(formatFcfa(-2500)).toBe("-2\u00A0500\u00A0FCFA");
  });
  it("refuse les décimales", () => {
    expect(() => formatFcfa(10.5)).toThrow(RangeError);
  });
});

describe("formatQuantite", () => {
  it("affiche 1 kg d'un sac de 50 kg sans erreur d'arrondi", () => {
    expect(formatQuantite(1 / 50)).toBe("0,02");
  });
  it("limite à 3 décimales", () => {
    expect(formatQuantite(1 / 3)).toBe("0,333");
  });
});

describe("formatDateHeure", () => {
  it("affiche l'heure de Douala (UTC+1)", () => {
    expect(formatDateHeure("2026-11-10T13:30:00Z")).toBe("10/11/2026 14:30");
  });
});
