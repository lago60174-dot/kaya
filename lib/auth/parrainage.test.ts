import { describe, expect, it } from "vitest";
import { normaliserCode } from "./parrainage";

describe("normaliserCode", () => {
  it("met en majuscules et retire les espaces", () =>
    expect(normaliserCode(" demo 20 ")).toBe("DEMO20"));
  it.each(["", "abc", "a".repeat(13), "AB-CD", "é€ÿÿ12"])("refuse %j", (c) =>
    expect(normaliserCode(c)).toBeNull(),
  );
});
