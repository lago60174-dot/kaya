import { describe, expect, it } from "vitest";
import { messageErreurBase } from "./erreurs";

describe("messageErreurBase", () => {
  it("montre les messages français levés par nos fonctions SQL", () => {
    expect(
      messageErreurBase({ code: "P0001", message: "Stock insuffisant." }),
    ).toBe("Stock insuffisant.");
  });
  it("traduit un doublon", () => {
    expect(
      messageErreurBase({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
    ).toMatch(/existe déjà/);
  });
  it("cache le détail technique des autres erreurs", () => {
    const m = messageErreurBase({
      code: "42501",
      message: "permission denied for table x",
    });
    expect(m).not.toMatch(/permission|table/);
    expect(messageErreurBase(null)).toBe(m);
  });
});
