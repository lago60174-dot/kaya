import { describe, expect, it } from "vitest";
import {
  bornesJour,
  calculerEcart,
  categoriesPour,
  decalerJour,
  especesAttendues,
  estJourValide,
  jourDemande,
  jourDouala,
  jugerEcart,
  libelleJour,
} from "./caisse";
import { clotureSchema, depenseSchema } from "./schemas";

const f = (n: number) => `${n} F`;

describe("espèces attendues et écart", () => {
  it("additionne les entrées et retire dépenses et avoirs en espèces", () => {
    expect(
      especesAttendues({
        encaissementsEspeces: 100_000,
        remboursementsCreditEspeces: 20_000,
        depensesEspeces: 7_500,
        avoirsEspeces: 11_000,
      }),
    ).toBe(101_500);
  });
  it("écart = compté - attendu (négatif = il manque)", () => {
    expect(calculerEcart(101_500, 99_500)).toBe(-2_000);
    expect(calculerEcart(101_500, 101_500)).toBe(0);
    expect(calculerEcart(101_500, 102_000)).toBe(500);
  });
  it("juge l'écart selon la tolérance (alerte seulement au-delà)", () => {
    expect(jugerEcart(0, 500, f).niveau).toBe("juste");
    expect(jugerEcart(-500, 500, f).niveau).toBe("tolere");
    expect(jugerEcart(500, 500, f).niveau).toBe("tolere");
    expect(jugerEcart(-501, 500, f)).toEqual({
      niveau: "alerte",
      message: "Il manque 501 F dans la caisse. Le propriétaire sera prévenu.",
    });
    expect(jugerEcart(1200, 500, f).message).toContain("en trop");
  });
});

describe("jours en heure de Douala", () => {
  it("23h30 UTC est déjà le lendemain à Douala", () => {
    expect(jourDouala(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-13");
    expect(jourDouala(new Date("2026-11-13T22:59:00Z"))).toBe("2026-11-13");
  });
  it("refuse les faux jours du calendrier", () => {
    expect(estJourValide("2026-02-30")).toBe(false);
    expect(estJourValide("2026-13-01")).toBe(false);
    expect(estJourValide("13/11/2026")).toBe(false);
    expect(estJourValide("2028-02-29")).toBe(true);
  });
  it("décale d'un jour sans piège de fin de mois ou d'année", () => {
    expect(decalerJour("2026-12-31", 1)).toBe("2027-01-01");
    expect(decalerJour("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => decalerJour("2026-02-30", 1)).toThrow();
  });
  it("donne les bornes d'un jour de Douala", () => {
    expect(bornesJour("2026-11-13")).toEqual({
      debut: "2026-11-13T00:00:00+01:00",
      fin: "2026-11-14T00:00:00+01:00",
    });
  });
  it("ramène le jour demandé à une valeur sûre", () => {
    const auj = "2026-11-13";
    expect(jourDemande(undefined, auj)).toBe(auj);
    expect(jourDemande("n'importe quoi", auj)).toBe(auj);
    expect(jourDemande("2027-01-01", auj)).toBe(auj);
    expect(jourDemande("2026-11-10", auj)).toBe("2026-11-10");
  });
  it("libellés des jours", () => {
    expect(libelleJour("2026-11-13", "2026-11-13")).toBe("Aujourd'hui");
    expect(libelleJour("2026-11-12", "2026-11-13")).toBe("Hier");
    expect(libelleJour("2026-11-10", "2026-11-13")).toBe("10/11/2026");
  });
});

describe("catégories de dépense", () => {
  it("le vendeur n'a pas « Salaire »", () => {
    expect(categoriesPour("vendeur").map((c) => c.code)).toEqual([
      "transport",
      "electricite",
      "autre",
    ]);
    expect(categoriesPour("proprietaire")).toHaveLength(4);
  });
});

describe("validation des saisies", () => {
  const cle = "3f1c7b7e-6a52-4f0b-9a55-0f6a6d5d6f01";
  it("accepte une dépense valide", () => {
    expect(
      depenseSchema.safeParse({
        cle,
        categorie: "transport",
        montant: 1500,
        mode: "especes",
        note: "  Taxi  ",
      }),
    ).toMatchObject({ success: true, data: { note: "Taxi" } });
  });
  it("refuse montant nul, décimal ou énorme, et catégorie inconnue", () => {
    const base = { cle, categorie: "autre", mode: "especes" };
    for (const montant of [0, -5, 12.5, 100_000_001])
      expect(depenseSchema.safeParse({ ...base, montant }).success).toBe(false);
    expect(
      depenseSchema.safeParse({ ...base, montant: 10, categorie: "loisirs" })
        .success,
    ).toBe(false);
  });
  it("valide la clôture : espèces comptées >= 0 et date réelle", () => {
    expect(
      clotureSchema.safeParse({ date: "2026-11-13", especesComptees: 0 })
        .success,
    ).toBe(true);
    expect(
      clotureSchema.safeParse({ date: "2026-11-13", especesComptees: -1 })
        .success,
    ).toBe(false);
    expect(
      clotureSchema.safeParse({ date: "2026-02-30", especesComptees: 10 })
        .success,
    ).toBe(false);
  });
});
