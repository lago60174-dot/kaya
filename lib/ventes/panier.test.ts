import { describe, expect, it } from "vitest";
import {
  ajouterAuPanier,
  arrondirProduit,
  brutLigne,
  calculerTotaux,
  changerQuantite,
  changerUnite,
  demandeParProduit,
  lignesEnRupture,
  remiseAutorisee,
  retirerDuPanier,
  totalLigne,
  type LignePanier,
  type ProduitVente,
} from "./panier";

const ciment: ProduitVente = {
  id: "p1",
  nom: "Ciment CPJ 42,5 · Dangote",
  uniteBase: "kg",
  stock: 100,
  unites: [
    { id: "sac", nom: "sac de 50 kg", facteur: 50, prixVente: 5500 },
    { id: "kg", nom: "kg", facteur: 1, prixVente: 130 },
  ],
};
const clous: ProduitVente = {
  id: "p2",
  nom: "Clous 3 pouces",
  uniteBase: "kg",
  stock: 10,
  unites: [{ id: "ckg", nom: "kg", facteur: 1, prixVente: 1200 }],
};
let n = 0;
const cle = () => `l${++n}`;
const ligne = (
  p: ProduitVente,
  uniteId: string,
  quantite = 1,
  remiseLigne = 0,
): LignePanier => ({ cle: cle(), produit: p, uniteId, quantite, remiseLigne });

describe("arrondirProduit (identique à round() de la base)", () => {
  it.each([
    [1, 5500, 5500],
    [0.02, 5500, 110],
    [2.5, 130, 325],
    [0.5, 1301, 651],
    [1.001, 500, 501],
    [0.333, 1000, 333],
    [0.0015, 1000, 2],
  ])("%s x %s = %s", (q, p, attendu) =>
    expect(arrondirProduit(q, p)).toBe(attendu),
  );
  it("reste exact sur les gros montants", () => {
    expect(arrondirProduit(100000, 99999999)).toBe(9999999900000);
  });
});

describe("panier", () => {
  it("un tap ajoute une ligne, un second tap sur la même unité ajoute 1", () => {
    let l = ajouterAuPanier([], ciment, "sac", cle);
    l = ajouterAuPanier(l, ciment, "sac", cle);
    expect(l).toHaveLength(1);
    expect(l[0].quantite).toBe(2);
  });
  it("une autre unité du même produit ou une autre marque fait une nouvelle ligne", () => {
    let l = ajouterAuPanier([], ciment, "sac", cle);
    l = ajouterAuPanier(l, ciment, "kg", cle);
    l = ajouterAuPanier(
      l,
      { ...ciment, id: "p1b", nom: "Ciment CPJ 42,5 · CIMAF" },
      "sac",
      cle,
    );
    expect(l).toHaveLength(3);
  });
  it("calcule les lignes et le total", () => {
    const l = [
      ligne(ciment, "sac", 2),
      ligne(ciment, "kg", 1),
      ligne(clous, "ckg", 0.5),
    ];
    expect(brutLigne(l[0])).toBe(11000);
    expect(calculerTotaux(l, 0)).toMatchObject({
      brut: 11730,
      remise: 0,
      total: 11730,
    });
  });
  it("applique remises de ligne et globale", () => {
    const l = [ligne(ciment, "sac", 2, 500)];
    expect(totalLigne(l[0])).toBe(10500);
    const t = calculerTotaux(l, 500);
    expect(t).toMatchObject({
      brut: 11000,
      remiseLignes: 500,
      remise: 1000,
      total: 10000,
    });
    expect(t.pourcentageRemise).toBeCloseTo(9.09, 2);
  });
  it("change la quantité, l'unité (la remise de ligne repart à zéro) et retire une ligne", () => {
    const l = [ligne(ciment, "sac", 1, 200)];
    expect(changerQuantite(l, l[0].cle, 3)[0].quantite).toBe(3);
    const u = changerUnite(l, l[0].cle, "kg")[0];
    expect(u).toMatchObject({ uniteId: "kg", remiseLigne: 0 });
    expect(retirerDuPanier(l, l[0].cle)).toEqual([]);
  });
  it("1 kg d'un produit en sacs de 50 kg : aucune erreur d'arrondi sur la demande", () => {
    expect(demandeParProduit([ligne(ciment, "kg", 1)]).get("p1")).toBe(1);
    expect(demandeParProduit([ligne(ciment, "sac", 0.02)]).get("p1")).toBe(1);
  });
});

describe("lignesEnRupture", () => {
  it("additionne les unités d'un même produit avant de comparer au stock", () => {
    const l = [ligne(ciment, "sac", 1), ligne(ciment, "kg", 60)]; // 50 + 60 = 110 > 100
    expect(lignesEnRupture(l)).toEqual([
      {
        produitId: "p1",
        nom: ciment.nom,
        demande: 110,
        stock: 100,
        uniteBase: "kg",
      },
    ]);
  });
  it("ne signale rien quand le stock suffit", () => {
    expect(
      lignesEnRupture([ligne(ciment, "sac", 2), ligne(clous, "ckg", 10)]),
    ).toEqual([]);
  });
});

describe("remiseAutorisee", () => {
  const t = (brut: number, remise: number) =>
    calculerTotaux(
      [
        ligne(
          {
            ...clous,
            unites: [{ id: "u", nom: "u", facteur: 1, prixVente: brut }],
          },
          "u",
        ),
      ],
      remise,
    );
  it("limite le vendeur au seuil, pas le propriétaire", () => {
    expect(remiseAutorisee("vendeur", 5, t(10000, 500))).toEqual({ ok: true });
    expect(remiseAutorisee("vendeur", 5, t(10000, 501))).toEqual({
      ok: false,
      message:
        "Remise trop élevée : le maximum pour un vendeur est de 5 %. Demandez au propriétaire.",
    });
    expect(remiseAutorisee("proprietaire", 5, t(10000, 5000))).toEqual({
      ok: true,
    });
  });
  it("refuse une remise qui annule le prix, même pour le propriétaire", () => {
    expect(remiseAutorisee("proprietaire", 5, t(10000, 10000)).ok).toBe(false);
    expect(remiseAutorisee("proprietaire", 5, t(10000, 12000)).ok).toBe(false);
  });
});
