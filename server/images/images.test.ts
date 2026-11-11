import { describe, expect, it, vi } from "vitest";
import { cleAppartient, construireCle, urlImage } from "./cles";
import { DUREE_URL_SECONDES, signerEnvoi } from "./signature";
import { verifierImageStockee, type BucketLu } from "./verification";

const ORG = "11111111-1111-4111-8111-111111111111";
const HASH = "a".repeat(64);

describe("clés R2", () => {
  it("range le fichier dans le dossier de l'organisation, la vignette à part", () => {
    expect(construireCle(ORG, HASH, "photo")).toBe(`${ORG}/${HASH}.webp`);
    expect(construireCle(ORG, HASH, "vignette")).toBe(`${ORG}/${HASH}-v.webp`);
    expect(urlImage(`${ORG}/${HASH}.webp`)).toBe(`/img/${ORG}/${HASH}.webp`);
  });
  it("refuse une empreinte invalide (pas de chemin forgé)", () => {
    expect(construireCle(ORG, "../../etc/passwd", "photo")).toBeNull();
    expect(construireCle(ORG, "A".repeat(64), "photo")).toBeNull();
  });
  it("vérifie l'appartenance : organisation et type", () => {
    expect(cleAppartient(`${ORG}/${HASH}.webp`, ORG, "photo")).toBe(true);
    expect(cleAppartient(`${ORG}/${HASH}-v.webp`, ORG, "vignette")).toBe(true);
    expect(cleAppartient(`${ORG}/${HASH}-v.webp`, ORG, "photo")).toBe(false);
    expect(
      cleAppartient(
        `${ORG}/${HASH}.webp`,
        "22222222-2222-4222-8222-222222222222",
        "photo",
      ),
    ).toBe(false);
    expect(cleAppartient(`${ORG}/../x.webp`, ORG, "photo")).toBe(false);
  });
});

describe("signerEnvoi", () => {
  it("produit une URL R2 signée de 5 minutes, pour cette clé seulement", async () => {
    const url = new URL(
      await signerEnvoi(
        {
          compteId: "cpt123",
          cleAcces: "AKIA",
          cleSecrete: "secret",
          bucket: "kaya-images",
        },
        `${ORG}/${HASH}.webp`,
      ),
    );
    expect(url.host).toBe("cpt123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/kaya-images/${ORG}/${HASH}.webp`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe(
      String(DUREE_URL_SECONDES),
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.search).not.toContain("secret");
  });
});

const webp = (octets = 3000) => {
  const o = new Uint8Array(octets);
  o.set(
    [..."RIFF"].map((c) => c.charCodeAt(0)),
    0,
  );
  o.set(
    [..."WEBP"].map((c) => c.charCodeAt(0)),
    8,
  );
  return o;
};
function bucketSimule(contenu: Uint8Array | null) {
  const supprimer = vi.fn(async () => {});
  const bucket: BucketLu = {
    head: async () => (contenu ? { size: contenu.length } : null),
    get: async (_c, opt) =>
      contenu
        ? {
            arrayBuffer: async () =>
              contenu.slice(
                opt?.range.offset ?? 0,
                (opt?.range.offset ?? 0) +
                  (opt?.range.length ?? contenu.length),
              ).buffer as ArrayBuffer,
          }
        : null,
    delete: supprimer,
  };
  return { bucket, supprimer };
}

describe("verifierImageStockee", () => {
  it("accepte un vrai WebP de taille permise", async () => {
    const { bucket, supprimer } = bucketSimule(webp());
    expect(await verifierImageStockee(bucket, "k", "photo")).toEqual({
      ok: true,
    });
    expect(supprimer).not.toHaveBeenCalled();
  });
  it("refuse et supprime un fichier qui n'est pas du WebP", async () => {
    const { bucket, supprimer } = bucketSimule(new Uint8Array(3000).fill(1));
    expect((await verifierImageStockee(bucket, "k", "photo")).ok).toBe(false);
    expect(supprimer).toHaveBeenCalledWith("k");
  });
  it("refuse et supprime un fichier trop lourd (photo > 100 Ko, vignette > 15 Ko)", async () => {
    const a = bucketSimule(webp(101 * 1024));
    expect((await verifierImageStockee(a.bucket, "k", "photo")).ok).toBe(false);
    expect(a.supprimer).toHaveBeenCalled();
    const b = bucketSimule(webp(16 * 1024));
    expect((await verifierImageStockee(b.bucket, "k", "vignette")).ok).toBe(
      false,
    );
    expect(
      (
        await verifierImageStockee(
          bucketSimule(webp(16 * 1024)).bucket,
          "k",
          "photo",
        )
      ).ok,
    ).toBe(true);
  });
  it("signale un fichier jamais reçu", async () => {
    const { bucket } = bucketSimule(null);
    expect(await verifierImageStockee(bucket, "k", "photo")).toEqual({
      ok: false,
      message: "La photo n'a pas été reçue. Réessayez.",
    });
  });
});
