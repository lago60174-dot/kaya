import { describe, expect, it } from "vitest";
import { parametresSchema } from "./schemas";

const ok = {
  nom: "Quincaillerie du Centre",
  adresse: "Marché Mokolo",
  telephone: "699 12 34 56",
  mentionLegale: "Merci !",
  seuilRemise: "5",
  plafondCredit: "100 000",
  stockNegatif: "non",
  ecartTolere: "500",
};
const msg = (o: Partial<typeof ok>) => {
  const r = parametresSchema.safeParse({ ...ok, ...o });
  return r.success ? null : r.error.issues[0].message;
};

describe("parametresSchema", () => {
  it("normalise les saisies", () => {
    expect(
      parametresSchema.parse({
        ...ok,
        seuilRemise: "7,5",
        plafondCredit: "1 500 000 ",
      }),
    ).toMatchObject({
      telephone: "+237699123456",
      seuilRemise: 7.5,
      plafondCredit: 1500000,
      stockNegatif: false,
    });
  });
  it("les champs facultatifs vides deviennent absents", () => {
    const r = parametresSchema.parse({
      ...ok,
      adresse: "  ",
      telephone: "",
      mentionLegale: "",
    });
    expect(r.adresse).toBeUndefined();
    expect(r.telephone).toBeUndefined();
    expect(r.mentionLegale).toBeUndefined();
  });
  it("refuse les valeurs invalides avec un message en français", () => {
    expect(msg({ nom: "a" })).toMatch(/nom de la boutique/);
    expect(msg({ telephone: "12" })).toMatch(/numéro camerounais/);
    expect(msg({ seuilRemise: "101" })).toMatch(/100 %/);
    expect(msg({ seuilRemise: "abc" })).toMatch(/pourcentage/);
    expect(msg({ seuilRemise: "5,555" })).toMatch(/pourcentage/);
    expect(msg({ seuilRemise: "-1" })).toMatch(/pourcentage/);
    expect(msg({ plafondCredit: "100000001" })).toMatch(/plafond/);
    expect(msg({ plafondCredit: "12,5" })).toMatch(/plafond/);
    expect(msg({ ecartTolere: "10000001" })).toMatch(/écart/);
    expect(msg({ stockNegatif: "peut-être" })).not.toBeNull();
  });
});
