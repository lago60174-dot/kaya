import { describe, expect, it } from "vitest";
import {
  ancienneteJours,
  detteAncienne,
  libelleAnciennete,
  repartirFifo,
  type CreanceOuverte,
} from "./credit";

const c = (id: string, date: string, solde: number): CreanceOuverte => ({
  id,
  numeroRecu: `R-${id}`,
  date,
  solde,
});
const dettes = [
  c("b", "2026-11-05T10:00:00Z", 2400),
  c("a", "2026-10-01T10:00:00Z", 5500),
  c("c", "2026-11-01T10:00:00Z", 1200),
];

describe("repartirFifo", () => {
  it("solde la plus ancienne dette d'abord, puis entame la suivante", () => {
    const r = repartirFifo(dettes, 6000);
    expect(r).toEqual({
      ok: true,
      detteApres: 3100,
      parts: [
        { creanceId: "a", numeroRecu: "R-a", montant: 5500, soldeApres: 0 },
        { creanceId: "c", numeroRecu: "R-c", montant: 500, soldeApres: 700 },
      ],
    });
  });
  it("un paiement total solde tout", () => {
    const r = repartirFifo(dettes, 9100);
    expect(r.ok && r.detteApres).toBe(0);
    expect(r.ok && r.parts.every((p) => p.soldeApres === 0)).toBe(true);
  });
  it("un petit paiement n'entame que la plus ancienne", () => {
    const r = repartirFifo(dettes, 1000);
    expect(r.ok && r.parts).toEqual([
      { creanceId: "a", numeroRecu: "R-a", montant: 1000, soldeApres: 4500 },
    ]);
  });
  it("à date égale, départage par identifiant (comme la base)", () => {
    const r = repartirFifo(
      [
        c("z", "2026-11-01T10:00:00Z", 100),
        c("m", "2026-11-01T10:00:00Z", 100),
      ],
      100,
    );
    expect(r.ok && r.parts[0].creanceId).toBe("m");
  });
  it("refuse un montant invalide, trop grand, ou un client sans dette", () => {
    expect(repartirFifo(dettes, 0)).toEqual({
      ok: false,
      erreur: "Le montant doit être supérieur à zéro.",
    });
    expect(repartirFifo(dettes, 12.5).ok).toBe(false);
    expect(repartirFifo(dettes, 9101)).toEqual({
      ok: false,
      erreur: "Le montant dépasse ce que le client doit.",
    });
    expect(repartirFifo([], 100)).toEqual({
      ok: false,
      erreur: "Ce client ne doit rien.",
    });
  });
  it("ne modifie pas la liste reçue", () => {
    const copie = JSON.stringify(dettes);
    repartirFifo(dettes, 100);
    expect(JSON.stringify(dettes)).toBe(copie);
  });
});

describe("ancienneté", () => {
  const maintenant = new Date("2026-11-12T10:00:00Z");
  it("compte les jours entiers à Douala", () => {
    expect(ancienneteJours("2026-11-12T08:00:00Z", maintenant)).toBe(0);
    expect(ancienneteJours("2026-11-11T23:30:00Z", maintenant)).toBe(0); // 00h30 le 12 à Douala
    expect(ancienneteJours("2026-11-11T10:00:00Z", maintenant)).toBe(1);
    expect(ancienneteJours("2026-10-13T10:00:00Z", maintenant)).toBe(30);
  });
  it("ne renvoie jamais de nombre négatif", () => {
    expect(ancienneteJours("2026-12-01T10:00:00Z", maintenant)).toBe(0);
  });
  it.each([
    [0, "aujourd'hui"],
    [1, "depuis hier"],
    [12, "depuis 12 jours"],
    [45, "depuis 1 mois"],
    [200, "depuis 6 mois"],
    [400, "depuis plus d'un an"],
  ])("%s jours -> %s", (j, t) => {
    expect(libelleAnciennete(j)).toBe(t);
  });
  it("signale à partir de 30 jours", () => {
    expect([detteAncienne(29), detteAncienne(30)]).toEqual([false, true]);
  });
});
