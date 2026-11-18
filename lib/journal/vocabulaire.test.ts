import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIONS, decrire, libelleAction } from "./journal";

describe("vocabulaire du journal", () => {
  it("chaque action écrite par la base a un libellé français", () => {
    const dossier = join(__dirname, "..", "..", "supabase", "migrations");
    const codes = new Set<string>();
    for (const f of readdirSync(dossier).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(join(dossier, f), "utf8");
      for (const m of sql.matchAll(/ecrire_journal\([^;]*?,\s*'([a-z_]+)'\s*,\s*'[a-z_]+'/g))
        codes.add(m[1]);
    }
    expect(codes.size).toBeGreaterThan(10);
    const manquants = [...codes].filter((c) => !(c in ACTIONS));
    expect(manquants).toEqual([]);
  });

  it("décrit les actions du multi-boutiques sans planter, même avec des détails incomplets", () => {
    expect(libelleAction("boutique_creee")).toBe("Boutique ajoutée");
    expect(decrire("boutique_creee", { nom: "Bastos" })).toBe("Boutique ajoutée : Bastos.");
    expect(decrire("boutique_creee", {})).toContain("nouvelle boutique");
    expect(
      decrire("vendeur_boutiques_modifiees", { vendeur: "Paul", boutiques: "A, B" }),
    ).toBe("Paul travaille maintenant dans : A, B.");
    expect(decrire("vendeur_boutiques_modifiees", {})).toContain("Un vendeur");
  });
});
