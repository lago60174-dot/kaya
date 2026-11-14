import { describe, expect, it } from "vitest";
import { documentDepuisPaiement, documentDepuisVente } from "./document";
import { recuExemple } from "./fixtures";
import { COLONNES_58MM, construireTicket } from "./ticket";

const texteTicket = (l: { texte: string }[]) =>
  l.map((x) => x.texte).join("\n");

describe("construireTicket (58 mm, 32 colonnes)", () => {
  const doc = documentDepuisVente(recuExemple);

  it("ne dépasse jamais 32 colonnes", () => {
    for (const repertoire of ["ascii", "cp858"] as const) {
      const lignes = construireTicket(doc, { repertoire });
      expect(
        Math.max(...lignes.map((l) => l.texte.length)),
      ).toBeLessThanOrEqual(COLONNES_58MM);
    }
  });
  it("contient le numéro, la boutique, le total, le paiement, le reste à payer, la mention", () => {
    const t = texteTicket(construireTicket(doc));
    for (const attendu of [
      "Quincaillerie du Centre",
      "Recu R-2026-000123",
      "10 500 FCFA",
      "Especes",
      "Reste a payer",
      "4 500 FCFA",
      "Client : Jean Mbarga",
      "Marchandise vendue",
      "Merci de votre confiance",
    ])
      expect(t, attendu).toContain(attendu);
  });
  it("aligne les montants sur la droite de la ligne", () => {
    const total = construireTicket(doc).find((l) =>
      l.texte.startsWith("TOTAL"),
    )!;
    expect(total.texte).toHaveLength(COLONNES_58MM);
    expect(total.texte.endsWith("10 500 FCFA")).toBe(true);
    expect(total.gras).toBe(true);
  });
  it("garde les accents en cp858 et les retire en ascii", () => {
    expect(
      texteTicket(construireTicket(doc, { repertoire: "cp858" })),
    ).toContain("Reçu R-2026-000123");
    expect(texteTicket(construireTicket(doc))).not.toMatch(/[^\x20-\x7e\n]/);
  });
  it("passe à la ligne un nom très long, sans perdre le montant", () => {
    const long = {
      ...recuExemple,
      lignes: [
        {
          ...recuExemple.lignes[0],
          nom: "Peinture glycéro satinée blanc cassé seau de 20 litres ".repeat(
            2,
          ),
        },
      ],
    };
    const lignes = construireTicket(documentDepuisVente(long));
    expect(Math.max(...lignes.map((l) => l.texte.length))).toBeLessThanOrEqual(
      32,
    );
    expect(texteTicket(lignes)).toContain("11 000 FCFA");
  });
  it("marque clairement un reçu annulé", () => {
    const t = construireTicket(
      documentDepuisVente({ ...recuExemple, annule: true }),
    );
    expect(t.some((l) => l.texte === "*** ANNULE ***" && l.grand)).toBe(true);
  });
  it("met en page un reçu de paiement : montants, soldé, reste, ou plus rien dû", () => {
    const p = documentDepuisPaiement({
      boutique: "Quincaillerie du Centre",
      numero: "P-2026-12",
      date: "2026-11-10T13:30:00Z",
      client: "Jean Mbarga",
      montant: 8000,
      mode: "mtn_momo",
      repartition: [
        { numeroRecuVente: "R-2026-000100", montant: 5000, soldeApres: 0 },
        { numeroRecuVente: "R-2026-000110", montant: 3000, soldeApres: 2000 },
      ],
      detteRestante: 2000,
    });
    const t = texteTicket(construireTicket(p));
    expect(t).toContain("Recu de paiement P-2026-12");
    expect(t).toContain("Paye par MTN MoMo");
    expect(t).toContain("Solde");
    expect(t).toContain("Reste 2 000 FCFA");
    expect(t).toContain("TOTAL PAYE");
    const fini = documentDepuisPaiement({ ...pBase(), detteRestante: 0 });
    expect(texteTicket(construireTicket(fini))).toContain(
      "Le client ne doit plus rien",
    );
  });
});

function pBase() {
  return {
    boutique: "B",
    numero: "P-1",
    date: "2026-11-10T13:30:00Z",
    client: "C",
    montant: 1000,
    mode: "especes",
    repartition: [{ numeroRecuVente: "R-1", montant: 1000, soldeApres: 0 }],
    detteRestante: 0,
  };
}
