import { describe, expect, it } from "vitest";
import { documentDepuisPaiement, documentDepuisVente } from "./document";
import { recuExemple } from "./fixtures";

describe("documentDepuisVente", () => {
  const d = documentDepuisVente(recuExemple);
  it("reprend le numéro, la boutique, le client et les lignes", () => {
    expect(d).toMatchObject({
      type: "vente",
      numero: "R-2026-000123",
      titre: "Reçu R-2026-000123",
      client: "Jean Mbarga",
      annule: false,
    });
    expect(d.lignes[0]).toMatchObject({
      designation: "Ciment CPJ 42,5 · Dangote",
      quantite: "2 sac de 50 kg",
      montant: "11 000 FCFA",
    });
    expect(d.lignes[0].detail).toBe("2 sac de 50 kg × 5 500 FCFA");
  });
  it("ordonne les totaux : remise, total, paiements, reste à payer", () => {
    expect(d.totaux.map((t) => [t.libelle, t.niveau])).toEqual([
      ["Remise", "normal"],
      ["TOTAL", "majeur"],
      ["Espèces", "discret"],
      ["Reste à payer", "fort"],
    ]);
  });
  it("signale la remise de ligne et omet remise et reste quand ils valent zéro", () => {
    const sans = documentDepuisVente({
      ...recuExemple,
      remise: 0,
      credit: 0,
      lignes: [{ ...recuExemple.lignes[0], remiseLigne: 200 }],
    });
    expect(sans.lignes[0].detail).toContain("(remise 200 FCFA)");
    expect(sans.totaux.map((t) => t.libelle)).toEqual(["TOTAL", "Espèces"]);
  });
  it("ne contient ni marge ni prix d'achat", () => {
    expect(JSON.stringify(d)).not.toMatch(/marge|achat|coût/i);
  });
});

describe("documentDepuisPaiement", () => {
  const p = documentDepuisPaiement(
    {
      boutique: "Quincaillerie du Centre",
      numero: "P-2026-12",
      date: "2026-11-10T13:30:00Z",
      client: "Jean Mbarga",
      montant: 8000,
      mode: "orange_money",
      repartition: [
        { numeroRecuVente: "R-2026-000100", montant: 5000, soldeApres: 0 },
        { numeroRecuVente: "R-2026-000110", montant: 3000, soldeApres: 2000 },
      ],
      detteRestante: 2000,
      boutiqueAdresse: "Yaoundé",
    },
    "Merci",
  );
  it("décrit le paiement et ce qu'il reste à devoir", () => {
    expect(p).toMatchObject({
      type: "paiement",
      titre: "Reçu de paiement P-2026-12",
      precision: "Payé par Orange Money",
      mentionLegale: "Merci",
    });
    expect(p.boutique.adresse).toBe("Yaoundé");
    expect(p.lignes.map((l) => l.detail)).toEqual([
      "Soldé",
      "Reste 2 000 FCFA",
    ]);
    expect(p.lignes[0].quantite).toBeNull();
    expect(p.totaux.at(-1)?.libelle).toBe("Reste à payer");
  });
});
