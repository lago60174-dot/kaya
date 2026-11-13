import { describe, expect, it } from "vitest";
import { estAndroid, lienRawBT, PAQUET_RAWBT, versBase64 } from "./rawbt";

describe("lienRawBT", () => {
  it("construit l'intention Android vers RawBT avec les octets en base64", () => {
    const lien = lienRawBT(Uint8Array.from([0x1b, 0x40, 0x41, 0x0a]));
    expect(lien).toBe(
      `intent:base64,G0BBCg==#Intent;scheme=rawbt;package=${PAQUET_RAWBT};end;`,
    );
  });
  it("encode sans erreur un très long reçu (plus de 32 768 octets)", () => {
    const grand = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    expect(Buffer.from(versBase64(grand), "base64")).toEqual(
      Buffer.from(grand),
    );
  });
});

describe("estAndroid", () => {
  it("reconnaît Android et pas un PC", () => {
    expect(
      estAndroid("Mozilla/5.0 (Linux; Android 12; TECNO) Chrome/120 Mobile"),
    ).toBe(true);
    expect(estAndroid("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe(false);
  });
});
