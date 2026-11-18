import { describe, expect, it } from "vitest";
import { lireLignesConsolidees, totaliser } from "./consolide";

const brut = (id: string, nom: string, ventes: number, extra = {}) => ({
  boutique_id: id,
  nom,
  en_ecriture: true,
  ventes_total: ventes,
  nb_ventes: 2,
  ventes_hier: 100,
  especes_attendues: ventes / 2,
  mobile_money: 50,
  depenses_total: 10,
  credit_accorde: 0,
  dettes_total: 300,
  nb_debiteurs: 1,
  stock_bas: 3,
  clotures_a_valider: 1,
  ...extra,
});

describe("lireLignesConsolidees", () => {
  it("lit les nombres, même envoyés en texte, et ignore les lignes illisibles", () => {
    const l = lireLignesConsolidees([
      brut("a", "Centre", 1000, { ventes_total: "1000" }),
      { nom: "sans id" },
      null,
    ]);
    expect(l).toHaveLength(1);
    expect(l[0].ventesTotal).toBe(1000);
  });
  it("renvoie une liste vide si la réponse n'est pas une liste", () => {
    expect(lireLignesConsolidees(undefined)).toEqual([]);
  });
});

describe("totaliser", () => {
  it("additionne toutes les boutiques", () => {
    const t = totaliser(
      lireLignesConsolidees([brut("a", "A", 1000), brut("b", "B", 2500)]),
    );
    expect(t.ventesTotal).toBe(3500);
    expect(t.nbVentes).toBe(4);
    expect(t.especesAttendues).toBe(1750);
    expect(t.dettesTotal).toBe(600);
    expect(t.stockBas).toBe(6);
    expect(t.cloturesAValider).toBe(2);
  });
  it("vaut zéro sans boutique", () => {
    expect(totaliser([]).ventesTotal).toBe(0);
  });
});
