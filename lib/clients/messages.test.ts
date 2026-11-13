import { describe, expect, it } from "vitest";
import { messagePaiement, messageRappel, prenomPourMessage } from "./messages";

describe("prenomPourMessage", () => {
  it.each([
    ["Jean Mbarga", "Jean"],
    ["Marie-Claire Fotso", "Marie-Claire"],
    ["Entreprise Tchoumi BTP", "Entreprise Tchoumi BTP"],
    ["Samuel", "Samuel"],
    ["  Aïcha   Ngono ", "Aïcha"],
  ])("%s -> %s", (nom, attendu) => {
    expect(prenomPourMessage(nom)).toBe(attendu);
  });
});

describe("messageRappel", () => {
  const m = messageRappel({
    boutique: "Quincaillerie du Centre",
    client: "Jean Mbarga",
    dette: 9100,
    recus: ["R-2026-000001", "R-2026-000004"],
  });
  it("est courtois, précis et propose des solutions", () => {
    expect(m).toContain("Bonjour Jean,");
    expect(m).toContain("C'est Quincaillerie du Centre.");
    expect(m).toContain("9\u00A0100\u00A0FCFA");
    expect(m).toContain("(R-2026-000001, R-2026-000004)");
    expect(m).toContain("Mobile Money");
    expect(m).toContain("Merci beaucoup");
  });
  it("ne contient ni reproche ni menace", () => {
    expect(m).not.toMatch(
      /retard|impayé|immédiatement|urgent|poursuite|dernier avis|sinon/i,
    );
  });
  it("abrège une longue liste de reçus et accepte l'absence de liste", () => {
    expect(
      messageRappel({
        boutique: "B",
        client: "Jean Mbarga",
        dette: 1,
        recus: ["1", "2", "3", "4", "5"],
      }),
    ).toContain("(1, 2, 3…)");
    expect(
      messageRappel({ boutique: "B", client: "Jean Mbarga", dette: 1000 }),
    ).toContain("à régler chez nous.");
  });
});

describe("messagePaiement", () => {
  const base = {
    boutique: "Quincaillerie du Centre",
    numero: "P-2026-000001",
    date: "2026-11-10T13:30:00Z",
    client: "Jean Mbarga",
    montant: 6000,
    mode: "especes",
    repartition: [
      { numeroRecuVente: "R-2026-000001", montant: 5500, soldeApres: 0 },
      { numeroRecuVente: "R-2026-000004", montant: 500, soldeApres: 700 },
    ],
    detteRestante: 3100,
  };
  it("détaille ce qui est soldé et ce qui reste", () => {
    const m = messagePaiement(base);
    expect(m).toContain("Reçu de paiement P-2026-000001 · 10/11/2026 14:30");
    expect(m).toContain("6\u00A0000\u00A0FCFA (Espèces)");
    expect(m).toContain("• R-2026-000001 : 5\u00A0500\u00A0FCFA (soldé)");
    expect(m).toContain(
      "• R-2026-000004 : 500\u00A0FCFA (reste 700\u00A0FCFA)",
    );
    expect(m).toContain("*Il vous reste 3\u00A0100\u00A0FCFA à régler.*");
  });
  it("remercie quand tout est payé et ajoute le lien s'il existe", () => {
    const m = messagePaiement(
      { ...base, detteRestante: 0 },
      "https://kaya.cm/x",
    );
    expect(m).toContain("Vous ne devez plus rien");
    expect(m.endsWith("https://kaya.cm/x")).toBe(true);
  });
});
