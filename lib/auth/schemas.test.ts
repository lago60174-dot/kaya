import { describe, expect, it } from "vitest";
import {
  changerMotDePasseSchema,
  connexionSchema,
  creerVendeurSchema,
  genererMotDePasseProvisoire,
  inscriptionSchema,
  normaliserTelephoneCm,
} from "./schemas";

describe("normaliserTelephoneCm", () => {
  it.each([
    ["699123456", "+237699123456"],
    ["6 99 12 34 56", "+237699123456"],
    ["+237 699 12 34 56", "+237699123456"],
    ["00237699123456", "+237699123456"],
    ["237677000000", "+237677000000"],
    ["222123456", "+237222123456"],
  ])("%s -> %s", (brut, attendu) =>
    expect(normaliserTelephoneCm(brut)).toBe(attendu),
  );
  it.each(["", "12345", "799123456", "69912345", "+33612345678", "abc"])(
    "refuse %s",
    (brut) => {
      expect(normaliserTelephoneCm(brut)).toBeNull();
    },
  );
});

const valide = {
  nomBoutique: " Quincaillerie Mvog ",
  ville: "Yaoundé",
  telephone: "699 12 34 56",
  email: " Patron@Test.CM ",
  motDePasse: "motdepasse1",
};

describe("inscriptionSchema", () => {
  it("nettoie et normalise les champs", () => {
    const r = inscriptionSchema.parse(valide);
    expect(r).toMatchObject({
      nomBoutique: "Quincaillerie Mvog",
      telephone: "+237699123456",
      email: "patron@test.cm",
    });
    expect(r.codeParrainage).toBeUndefined();
  });
  it("accepte un code de parrainage en minuscules avec espaces", () => {
    expect(
      inscriptionSchema.parse({ ...valide, codeParrainage: " abc 123 " })
        .codeParrainage,
    ).toBe("ABC123");
  });
  it("ignore un code vide mais refuse un code mal formé", () => {
    expect(
      inscriptionSchema.parse({ ...valide, codeParrainage: "  " })
        .codeParrainage,
    ).toBeUndefined();
    expect(
      inscriptionSchema.safeParse({ ...valide, codeParrainage: "a!" }).success,
    ).toBe(false);
  });
  it("donne des messages en français", () => {
    const r = inscriptionSchema.safeParse({
      ...valide,
      email: "oups",
      telephone: "12",
      motDePasse: "court1",
    });
    expect(r.success).toBe(false);
    const messages = r.error?.issues.map((i) => i.message).join(" ");
    expect(messages).toMatch(/adresse email valide/);
    expect(messages).toMatch(/numéro camerounais/);
    expect(messages).toMatch(/au moins 8 caractères/);
  });
  it("exige une lettre et un chiffre dans le mot de passe", () => {
    expect(
      inscriptionSchema.safeParse({ ...valide, motDePasse: "12345678" })
        .success,
    ).toBe(false);
    expect(
      inscriptionSchema.safeParse({ ...valide, motDePasse: "abcdefgh" })
        .success,
    ).toBe(false);
  });
});

describe("connexion, vendeur, mot de passe", () => {
  it("connexionSchema normalise l'email", () => {
    expect(
      connexionSchema.parse({ email: " A@B.CM ", motDePasse: "x" }).email,
    ).toBe("a@b.cm");
  });
  it("creerVendeurSchema exige un nom et un email", () => {
    expect(
      creerVendeurSchema.safeParse({ nom: "A", email: "a@b.cm" }).success,
    ).toBe(false);
    expect(
      creerVendeurSchema.safeParse({ nom: "Paul", email: "paul@b.cm" }).success,
    ).toBe(true);
  });
  it("changerMotDePasseSchema exige deux saisies identiques", () => {
    const r = changerMotDePasseSchema.safeParse({
      nouveau: "bonmotdepasse1",
      confirmation: "autre",
    });
    expect(r.error?.issues[0].path).toEqual(["confirmation"]);
    expect(
      changerMotDePasseSchema.safeParse({
        nouveau: "bonmotdepasse1",
        confirmation: "bonmotdepasse1",
      }).success,
    ).toBe(true);
  });
});

describe("genererMotDePasseProvisoire", () => {
  it("produit 10 caractères lisibles avec lettre et chiffre", () => {
    for (let i = 0; i < 50; i++) {
      const mdp = genererMotDePasseProvisoire(
        crypto.getRandomValues(new Uint8Array(16)),
      );
      expect(mdp).toHaveLength(10);
      expect(mdp).toMatch(/[A-Za-z]/);
      expect(mdp).toMatch(/\d/);
      expect(mdp).not.toMatch(/[0OIl1]/);
    }
  });
  it("garantit un chiffre et une lettre même avec des octets défavorables", () => {
    expect(genererMotDePasseProvisoire(new Uint8Array(16).fill(0))).toMatch(
      /\d/,
    );
    expect(genererMotDePasseProvisoire(new Uint8Array(16).fill(40))).toMatch(
      /[A-Za-z]/,
    );
  });
  it("refuse trop peu d'octets", () => {
    expect(() => genererMotDePasseProvisoire(new Uint8Array(3))).toThrow(
      RangeError,
    );
  });
});
