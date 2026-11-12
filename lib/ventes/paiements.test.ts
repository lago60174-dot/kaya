import { describe, expect, it } from "vitest";
import { libelleMode, preparerPaiements } from "./paiements";

const esp = (montant = "") => ({ mode: "especes" as const, montant });
const momo = (montant = "") => ({ mode: "mtn_momo" as const, montant });

describe("preparerPaiements sans crédit", () => {
  it("un seul mode paie tout : le montant est laissé au serveur", () => {
    expect(preparerPaiements([esp()], false, 5500)).toEqual({
      ok: true,
      paiements: [{ mode: "especes" }],
      credit: 0,
    });
  });
  it("paiement mixte : le dernier mode prend le reste", () => {
    expect(preparerPaiements([esp("2 000"), momo()], false, 5500)).toEqual({
      ok: true,
      paiements: [{ mode: "especes", montant: 2000 }, { mode: "mtn_momo" }],
      credit: 0,
    });
  });
  it("refuse un montant manquant ou invalide avant le dernier mode", () => {
    expect(preparerPaiements([esp(""), momo()], false, 5500).ok).toBe(false);
    expect(preparerPaiements([esp("12,5"), momo()], false, 5500).ok).toBe(
      false,
    );
  });
  it("refuse quand les premiers paiements couvrent déjà le total", () => {
    const r = preparerPaiements([esp("6000"), momo()], false, 5500);
    expect(r).toEqual({
      ok: false,
      erreur:
        "Les premiers paiements couvrent déjà le total : retirez le dernier mode.",
    });
  });
  it("exige un mode de paiement et un total positif", () => {
    expect(preparerPaiements([], false, 5500).ok).toBe(false);
    expect(preparerPaiements([esp()], false, 0)).toEqual({
      ok: false,
      erreur: "Ajoutez au moins un article.",
    });
  });
});

describe("preparerPaiements avec crédit", () => {
  it("sans aucun paiement : tout est à crédit", () => {
    expect(preparerPaiements([], true, 5500)).toEqual({
      ok: true,
      paiements: [],
      credit: 5500,
    });
  });
  it("avec un acompte : le reste devient la dette", () => {
    expect(preparerPaiements([esp("1000")], true, 5500)).toEqual({
      ok: true,
      paiements: [{ mode: "especes", montant: 1000 }],
      credit: 4500,
    });
  });
  it("chaque ligne doit avoir un montant", () => {
    expect(preparerPaiements([esp("")], true, 5500).ok).toBe(false);
    expect(preparerPaiements([esp("0")], true, 5500).ok).toBe(false);
  });
  it("refuse un crédit quand le total est déjà couvert", () => {
    expect(preparerPaiements([esp("5500")], true, 5500)).toEqual({
      ok: false,
      erreur: "Le montant payé couvre déjà le total : retirez le crédit.",
    });
  });
});

describe("libelleMode", () => {
  it("donne des libellés lisibles", () => {
    expect(libelleMode("mtn_momo")).toBe("MTN MoMo");
    expect(libelleMode("autre")).toBe("autre");
  });
});
