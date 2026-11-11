import { describe, expect, it, vi } from "vitest";
import {
  chercherQualite,
  dimensionsCibles,
  empreinteHex,
  LIMITES_IMAGE,
  TAILLE_MAX_ORIGINE,
  verifierFichierImage,
} from "./compression";

/** Encodeur simulé : le poids augmente avec la qualité (comme un vrai WebP). */
const encodeurSimule = (octetsALaQualiteMax: number) =>
  vi.fn(
    async (q: number) =>
      new Blob([new Uint8Array(Math.round(octetsALaQualiteMax * q))]),
  );

describe("dimensionsCibles", () => {
  it("réduit à 800 px de large en gardant les proportions", () => {
    expect(dimensionsCibles(4000, 3000, 800)).toEqual({
      largeur: 800,
      hauteur: 600,
    });
  });
  it("n'agrandit jamais une petite image", () => {
    expect(dimensionsCibles(500, 400, 800)).toEqual({
      largeur: 500,
      hauteur: 400,
    });
  });
  it("ne descend jamais sous 1 px de haut", () => {
    expect(dimensionsCibles(100000, 1, 800).hauteur).toBe(1);
  });
});

describe("chercherQualite", () => {
  it("garde la qualité maximale quand le fichier tient déjà", async () => {
    const enc = encodeurSimule(50_000);
    const r = await chercherQualite(enc, LIMITES_IMAGE.photo.octets);
    expect(r?.size).toBeLessThanOrEqual(LIMITES_IMAGE.photo.octets);
    expect(enc).toHaveBeenCalledTimes(1);
  });
  it("trouve une qualité qui passe sous 100 Ko pour une photo lourde, la plus haute possible", async () => {
    const r = await chercherQualite(
      encodeurSimule(200_000),
      LIMITES_IMAGE.photo.octets,
    );
    expect(r).not.toBeNull();
    expect(r!.size).toBeLessThanOrEqual(100 * 1024);
    expect(r!.size).toBeGreaterThan(90 * 1024); // proche de la limite : on ne sacrifie pas la qualité pour rien
  });
  it("vise 15 Ko pour une vignette", async () => {
    const r = await chercherQualite(
      encodeurSimule(40_000),
      LIMITES_IMAGE.vignette.octets,
    );
    expect(r!.size).toBeLessThanOrEqual(15 * 1024);
  });
  it("renvoie null si même la qualité la plus basse est trop lourde", async () => {
    expect(
      await chercherQualite(
        encodeurSimule(10_000_000),
        LIMITES_IMAGE.photo.octets,
      ),
    ).toBeNull();
  });
});

describe("verifierFichierImage", () => {
  it("accepte une photo de 4 Mo", () => {
    expect(
      verifierFichierImage({ type: "image/jpeg", size: 4 * 1024 * 1024 }),
    ).toEqual({ ok: true });
  });
  it("refuse un fichier qui n'est pas une image", () => {
    expect(
      verifierFichierImage({ type: "application/pdf", size: 1000 }),
    ).toEqual({ ok: false, message: "Ce fichier n'est pas une image." });
  });
  it("refuse un fichier trop lourd", () => {
    expect(
      verifierFichierImage({ type: "image/png", size: TAILLE_MAX_ORIGINE + 1 })
        .ok,
    ).toBe(false);
  });
});

describe("empreinteHex", () => {
  it("donne un SHA-256 stable de 64 caractères", async () => {
    expect(await empreinteHex(new Blob(["abc"]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("change avec le contenu", async () => {
    expect(await empreinteHex(new Blob(["abd"]))).not.toBe(
      await empreinteHex(new Blob(["abc"])),
    );
  });
});
