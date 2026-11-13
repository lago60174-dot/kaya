import { describe, expect, it } from "vitest";
import { clientSchema, paiementCreditSchema } from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";

describe("clientSchema", () => {
  it("normalise le téléphone et lit le plafond", () => {
    expect(
      clientSchema.parse({
        nom: " Jean Mbarga ",
        telephone: "699 11 11 11",
        plafondCredit: "250 000",
        notes: "Bon payeur",
      }),
    ).toMatchObject({
      nom: "Jean Mbarga",
      telephone: "+237699111111",
      plafondCredit: 250000,
      notes: "Bon payeur",
    });
  });
  it("accepte un client avec seulement un nom", () => {
    const r = clientSchema.parse({
      nom: "Paul Essomba",
      telephone: "",
      notes: "",
      plafondCredit: "",
    });
    expect(r.telephone).toBeUndefined();
    expect(r.plafondCredit).toBeUndefined();
  });
  it("refuse un numéro invalide, un plafond décimal et des notes trop longues, en français", () => {
    const msg = (v: object) =>
      clientSchema.safeParse({ nom: "Jean Mbarga", ...v }).error?.issues[0]
        .message;
    expect(msg({ telephone: "12" })).toMatch(/numéro camerounais/);
    expect(msg({ plafondCredit: "12,5" })).toMatch(/sans décimales/);
    expect(msg({ notes: "x".repeat(501) })).toMatch(/trop longues/);
    expect(clientSchema.safeParse({ nom: "J" }).success).toBe(false);
  });
});

describe("paiementCreditSchema", () => {
  const base = { clientId: ID, cle: ID, mode: "mtn_momo", montant: 5000 };
  it("accepte un paiement valide", () => {
    expect(paiementCreditSchema.parse(base)).toEqual(base);
  });
  it.each([
    ["montant nul", { montant: 0 }],
    ["montant décimal", { montant: 10.5 }],
    ["mode inconnu", { mode: "cheque" }],
    ["client invalide", { clientId: "x" }],
    ["clé absente", { cle: undefined }],
  ])("refuse %s", (_n, v) => {
    expect(paiementCreditSchema.safeParse({ ...base, ...v }).success).toBe(
      false,
    );
  });
});
