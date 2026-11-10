import { describe, expect, it, vi } from "vitest";
import { verifierTurnstile } from "./turnstile";

const reponse = (corps: unknown, ok = true) =>
  vi.fn().mockResolvedValue({
    ok,
    json: async () => corps,
  }) as unknown as typeof fetch;

describe("verifierTurnstile", () => {
  it("sans clé : accepté en développement, refusé en production", async () => {
    expect(await verifierTurnstile(null, { production: false })).toBe(true);
    expect(await verifierTurnstile("x", { production: true })).toBe(false);
  });
  it("refuse l'absence de jeton quand la clé est configurée", async () => {
    expect(await verifierTurnstile("", { secret: "s", production: true })).toBe(
      false,
    );
  });
  it("accepte quand Cloudflare confirme, avec l'adresse IP", async () => {
    const f = reponse({ success: true });
    expect(
      await verifierTurnstile("jeton", {
        secret: "s",
        ip: "1.2.3.4",
        production: true,
        fetchImpl: f,
      }),
    ).toBe(true);
    const corps = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .body as URLSearchParams;
    expect(corps.get("response")).toBe("jeton");
    expect(corps.get("remoteip")).toBe("1.2.3.4");
  });
  it("refuse quand Cloudflare refuse, répond mal ou ne répond pas", async () => {
    expect(
      await verifierTurnstile("j", {
        secret: "s",
        production: true,
        fetchImpl: reponse({ success: false }),
      }),
    ).toBe(false);
    expect(
      await verifierTurnstile("j", {
        secret: "s",
        production: true,
        fetchImpl: reponse({}, false),
      }),
    ).toBe(false);
    const panne = vi
      .fn()
      .mockRejectedValue(new Error("réseau")) as unknown as typeof fetch;
    expect(
      await verifierTurnstile("j", {
        secret: "s",
        production: true,
        fetchImpl: panne,
      }),
    ).toBe(false);
  });
});
