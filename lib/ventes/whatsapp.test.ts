import { describe, expect, it } from "vitest";
import { lienWhatsApp, messageRecu, numeroWhatsApp } from "./whatsapp";

describe("numeroWhatsApp et lienWhatsApp", () => {
  it.each([
    ["699 11 11 11", "237699111111"],
    ["+237699111111", "237699111111"],
    ["237699111111", "237699111111"],
  ])("%s -> %s", (t, n) => expect(numeroWhatsApp(t)).toBe(n));
  it("renvoie null pour un numéro absent ou invalide", () => {
    expect(numeroWhatsApp(null)).toBeNull();
    expect(numeroWhatsApp("12")).toBeNull();
  });
  it("ouvre la conversation du client quand son numéro est connu, sinon le choix du contact", () => {
    expect(lienWhatsApp("699111111", "Bonjour")).toBe(
      "https://wa.me/237699111111?text=Bonjour",
    );
    expect(lienWhatsApp(null, "a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });
});

const recu = {
  boutique: "Quincaillerie du Centre",
  numero: "R-2026-000123",
  date: "2026-11-10T13:30:00Z",
  lignes: [
    {
      nom: "Ciment CPJ 42,5 · Dangote",
      quantite: 2,
      unite: "sacs de 50 kg",
      total: 11000,
    },
  ],
  remise: 500,
  total: 10500,
  paiements: [{ mode: "especes", montant: 6000 }],
  credit: 4500,
};

describe("messageRecu", () => {
  const m = messageRecu(recu);
  it("résume le reçu en français avec le reste à payer", () => {
    expect(m).toContain("*Quincaillerie du Centre*");
    expect(m).toContain("Reçu R-2026-000123 · 10/11/2026 14:30");
    expect(m).toContain(
      "• 2 sacs de 50 kg Ciment CPJ 42,5 · Dangote : 11\u00A0000\u00A0FCFA",
    );
    expect(m).toContain("*Total : 10\u00A0500\u00A0FCFA*");
    expect(m).toContain(
      "Payé : 6\u00A0000\u00A0FCFA (Espèces 6\u00A0000\u00A0FCFA)",
    );
    expect(m).toContain("Reste à payer : 4\u00A0500\u00A0FCFA");
  });
  it("omet remise et crédit quand il n'y en a pas, et signale un reçu annulé", () => {
    const sans = messageRecu({ ...recu, remise: 0, credit: 0, annule: true });
    expect(sans).not.toContain("Remise");
    expect(sans).not.toContain("Reste à payer");
    expect(sans).toContain("ANNULÉ");
  });
  it("ne contient aucune donnée sensible", () => {
    expect(m).not.toMatch(/marge|prix d'achat|coût/i);
  });
});
