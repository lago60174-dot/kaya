import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { documentDepuisPaiement } from "@/lib/print/document";
import {
  couper,
  genererDocumentPdf,
  genererRecuPdf,
  nettoyerPourPdf,
} from "./pdf";
import type { RecuAffichable } from "./recu";

const recu: RecuAffichable = {
  numeroRecu: "R-2026-000123",
  date: "2026-11-10T13:30:00Z",
  annule: false,
  remise: 500,
  total: 10500,
  boutique: {
    nom: "Quincaillerie du Centre",
    adresse: "Marché Mfoundi, Yaoundé",
    telephone: "699000000",
    mentionLegale: "Marchandise vendue, ni reprise ni échangée.",
  },
  client: { nom: "Jean Mbarga", telephone: null },
  lignes: [
    {
      nom: "Ciment CPJ 42,5 · Dangote",
      unite: "sac de 50 kg",
      quantite: 2,
      prixUnitaire: 5500,
      remiseLigne: 0,
      total: 11000,
    },
  ],
  paiements: [{ mode: "especes", montant: 6000 }],
  credit: 4500,
};

/** Relit le texte écrit dans la page (flux compressé -> opérateurs -> chaînes hexadécimales). */
async function texteDuPdf(octets: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(octets);
  const contenu = doc.getPage(0).node.Contents();
  const flux =
    contenu instanceof PDFArray
      ? contenu.asArray().map((r) => doc.context.lookup(r))
      : [contenu];
  const operateurs = flux
    .filter((f): f is PDFRawStream => f instanceof PDFRawStream)
    .map((f) => Buffer.from(decodePDFRawStream(f).decode()).toString("latin1"))
    .join("\n");
  return [...operateurs.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
    .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
    .join("\n");
}

describe("nettoyerPourPdf", () => {
  it("garde le français et remplace ce que la police ne sait pas écrire", () => {
    expect(nettoyerPourPdf("Ciment CPJ 42,5 · Dangote — très ‘bon’")).toBe(
      "Ciment CPJ 42,5 · Dangote - très 'bon'",
    );
    expect(nettoyerPourPdf("Ω 10 mm → fer\nbéton")).toBe("? 10 mm ? fer béton");
    expect(nettoyerPourPdf("cœur…")).toBe("coeur...");
  });
});

describe("couper", () => {
  const police = {
    widthOfTextAtSize: (t: string, taille: number) => t.length * taille * 0.5,
  };
  it("passe à la ligne sans dépasser la largeur", () => {
    const l = couper("Ciment CPJ 42,5 Dangote sac de 50 kg", police, 10, 100);
    expect(l.length).toBeGreaterThan(1);
    expect(l.every((x) => police.widthOfTextAtSize(x, 10) <= 100)).toBe(true);
    expect(l.join(" ")).toBe("Ciment CPJ 42,5 Dangote sac de 50 kg");
  });
  it("coupe un mot trop long sans boucler", () => {
    const l = couper("A".repeat(80), police, 10, 100);
    expect(l.every((x) => x.length <= 20)).toBe(true);
    expect(l.join("")).toBe("A".repeat(80));
  });
  it("gère le texte vide", () => {
    expect(couper("   ", police, 10, 100)).toEqual([]);
  });
});

describe("genererRecuPdf", () => {
  it("produit un vrai PDF d'une page, étroit comme un ticket, avec le titre du reçu", async () => {
    const octets = await genererRecuPdf(recu);
    expect(Buffer.from(octets.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBe(300);
    expect(doc.getTitle()).toBe("Reçu R-2026-000123");
    expect(octets.length).toBeLessThan(20_000);
  });
  it("contient le numéro, la marque, le total, le paiement et le reste à payer", async () => {
    const t = await texteDuPdf(await genererRecuPdf(recu));
    for (const attendu of [
      "Quincaillerie du Centre",
      "Reçu R-2026-000123",
      "10\u00A0500\u00A0FCFA",
      "Espèces",
      "Reste à payer",
      "4\u00A0500\u00A0FCFA",
      "Ciment CPJ 42,5 · Dangote",
      "Jean Mbarga",
      "Merci de votre confiance",
    ]) {
      expect(t, attendu).toContain(attendu);
    }
    expect(t).not.toMatch(/marge|achat|coût/i);
  });
  it("marque un reçu annulé", async () => {
    expect(
      await texteDuPdf(await genererRecuPdf({ ...recu, annule: true })),
    ).toContain("ANNULÉ");
  });
  it("ne plante pas avec des caractères exotiques ni un très long reçu, et reste sur une page", async () => {
    const lignes = Array.from({ length: 80 }, (_, i) => ({
      nom: `Article Ø${i} — très ‘spécial’ ${"long ".repeat(12)}`,
      unite: "pièce",
      quantite: 1.5,
      prixUnitaire: 1000 + i,
      remiseLigne: 100,
      total: 1400,
    }));
    const octets = await genererRecuPdf({
      ...recu,
      lignes,
      credit: 0,
      paiements: [],
      remise: 0,
    });
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getHeight()).toBeGreaterThan(1500);
  });
  it("accepte un reçu minimal (pas d'adresse, de client ni de mention)", async () => {
    const minimal = {
      ...recu,
      boutique: {
        nom: "B",
        adresse: null,
        telephone: null,
        mentionLegale: null,
      },
      client: null,
      remise: 0,
      credit: 0,
      paiements: [],
    };
    expect(
      (await PDFDocument.load(await genererRecuPdf(minimal))).getPageCount(),
    ).toBe(1);
  });
  it("garde le vrai flux de contenu (sanity)", async () => {
    const doc = await PDFDocument.load(await genererRecuPdf(recu));
    expect(doc.getPage(0).node.get(PDFName.of("Contents"))).toBeDefined();
  });
});

/** PNG 1 x 1 pixel valide. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("logo", () => {
  it("place le logo en haut du reçu et agrandit la page de sa hauteur", async () => {
    const sans = await PDFDocument.load(await genererRecuPdf(recu));
    const avec = await PDFDocument.load(
      await genererRecuPdf(recu, {
        logo: { octets: new Uint8Array(PNG_1X1), format: "png" },
      }),
    );
    expect(avec.getPage(0).getHeight()).toBeGreaterThan(
      sans.getPage(0).getHeight(),
    );
    expect(avec.getPageCount()).toBe(1);
  });
  it("ignore un logo illisible au lieu de planter", async () => {
    const octets = await genererRecuPdf(recu, {
      logo: { octets: Uint8Array.from([1, 2, 3]), format: "png" },
    });
    const doc = await PDFDocument.load(octets);
    const sans = await PDFDocument.load(await genererRecuPdf(recu));
    expect(doc.getPage(0).getHeight()).toBe(sans.getPage(0).getHeight());
  });
});

describe("genererDocumentPdf (reçu de paiement)", () => {
  it("écrit le numéro de paiement, le mode, les ventes soldées et le reste dû", async () => {
    const t = await texteDuPdf(
      await genererDocumentPdf(
        documentDepuisPaiement({
          boutique: "Quincaillerie du Centre",
          numero: "P-2026-12",
          date: "2026-11-10T13:30:00Z",
          client: "Jean Mbarga",
          montant: 8000,
          mode: "mtn_momo",
          repartition: [
            { numeroRecuVente: "R-2026-000100", montant: 5000, soldeApres: 0 },
            {
              numeroRecuVente: "R-2026-000110",
              montant: 3000,
              soldeApres: 2000,
            },
          ],
          detteRestante: 2000,
        }),
      ),
    );
    for (const attendu of [
      "Reçu de paiement P-2026-12",
      "Payé par MTN MoMo",
      "R-2026-000100",
      "Soldé",
      "Reste 2 000 FCFA", // détail coupé par mots : espaces normales
      "TOTAL PAYÉ",
      "8\u00A0000\u00A0FCFA",
    ])
      expect(t, attendu).toContain(attendu);
  });
});
