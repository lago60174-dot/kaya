import { describe, expect, it, vi } from "vitest";
import { imprimerRecu, type Environnement, type RecuImprimable } from "./index";

const ANDROID = "Mozilla/5.0 (Linux; Android 12) Chrome/120 Mobile";
const PC = "Mozilla/5.0 (Windows NT 10.0) Chrome/120";

function env(o: Partial<Environnement> & { userAgent: string }): Environnement {
  return {
    ouvrirLien: vi.fn(),
    imprimerPage: vi.fn(async () => {}),
    ouvrirPdf: vi.fn(),
    ...o,
  };
}
const recu = (escpos?: RecuImprimable["escpos"]): RecuImprimable => ({
  numero: "R-2026-000123",
  escpos: escpos ?? (async () => Uint8Array.from([0x1b, 0x40])),
  pdfUrl: "/vente/recu/abc/pdf",
});

describe("imprimerRecu", () => {
  it("Android + ticket : envoie le ticket à RawBT", async () => {
    const e = env({ userAgent: ANDROID });
    expect(await imprimerRecu(recu(), "ticket", e)).toEqual({
      ok: true,
      methode: "rawbt",
    });
    expect(e.ouvrirLien).toHaveBeenCalledWith(
      expect.stringMatching(/^intent:base64,G0A=#Intent;scheme=rawbt;/),
    );
    expect(e.imprimerPage).not.toHaveBeenCalled();
  });
  it("PC : boîte d'impression du navigateur, au format demandé", async () => {
    const e = env({ userAgent: PC });
    expect(await imprimerRecu(recu(), "a4", e)).toEqual({
      ok: true,
      methode: "navigateur",
    });
    expect(e.imprimerPage).toHaveBeenCalledWith("a4");
  });
  it("Android + A4 : pas de RawBT (imprimante thermique), boîte d'impression", async () => {
    const e = env({ userAgent: ANDROID });
    await imprimerRecu(recu(), "a4", e);
    expect(e.ouvrirLien).not.toHaveBeenCalled();
    expect(e.imprimerPage).toHaveBeenCalledWith("a4");
  });
  it("RawBT en échec (réseau, lien) : repli sur le navigateur", async () => {
    const e = env({ userAgent: ANDROID });
    const r = await imprimerRecu(
      recu(async () => {
        throw new Error("réseau");
      }),
      "ticket",
      e,
    );
    expect(r).toEqual({ ok: true, methode: "navigateur" });
  });
  it("navigateur en échec : repli sur le PDF", async () => {
    const e = env({
      userAgent: PC,
      imprimerPage: async () => {
        throw new Error("bloqué");
      },
    });
    expect(await imprimerRecu(recu(), "ticket", e)).toEqual({
      ok: true,
      methode: "pdf",
    });
    expect(e.ouvrirPdf).toHaveBeenCalledWith("/vente/recu/abc/pdf");
  });
  it("tout échoue : message clair, aucune exception (la vente reste enregistrée)", async () => {
    const e = env({
      userAgent: PC,
      imprimerPage: async () => {
        throw new Error("x");
      },
      ouvrirPdf: () => {
        throw new Error("fenêtre bloquée");
      },
    });
    const r = await imprimerRecu(recu(), "ticket", e);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/vente est bien enregistrée/);
  });
});
