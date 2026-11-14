import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { actionsVisibles, actionsDeCategorie } from "../../lib/journal/journal";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;

interface Page {
  entrees: {
    id: number;
    cree_le: string;
    action: string;
    alerte: boolean;
    details: Record<string, unknown>;
  }[];
  suivant: { date: string; id: number } | null;
}

const lister = (
  user: string | null,
  o: {
    boutique?: string | null;
    actions?: string[] | null;
    alertes?: boolean;
    du?: string | null;
    au?: string | null;
    limite?: number;
    apres?: { date: string; id: number } | null;
  } = {},
) =>
  lignes<{ r: Page }>(
    db,
    user,
    "select lister_journal($1, $2, $3, $4::date, $5::date, $6, $7::timestamptz, $8::bigint) as r",
    [
      o.boutique ?? null,
      o.actions ?? null,
      o.alertes ?? false,
      o.du ?? null,
      o.au ?? null,
      o.limite ?? 30,
      o.apres?.date ?? null,
      o.apres?.id ?? null,
    ],
  ).then((x) => x[0].r);

const vendre = (user: string, q: number, remise = 0) =>
  lignes(
    db,
    user,
    "select creer_vente($1, $2, $3::jsonb, $4::jsonb, null, $5) as r",
    [
      f.boutiqueA,
      cle(),
      JSON.stringify([
        {
          produit_id: f.ciment.id,
          unite_id: f.ciment.unites.kg,
          quantite: q,
        },
      ]),
      JSON.stringify([{ mode: "especes" }]),
      remise,
    ],
  );

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
  for (let i = 1; i <= 5; i++) await vendre(U.vendeurA, i);
  await vendre(U.vendeurA, 20, 100); // remise (> moitié du seuil de 5 % ? 100 sur 2600 = 3,8 %) -> alerte
  await lignes(
    db,
    U.patronA,
    "select enregistrer_depense($1, 'autre', 500, 'especes', null, $2)",
    [f.boutiqueA, cle()],
  );
});

describe("lister_journal", () => {
  it("est réservé au propriétaire (la RLS cache tout au vendeur et à une autre organisation)", async () => {
    expect((await lister(U.patronA)).entrees.length).toBeGreaterThan(5);
    expect((await lister(U.vendeurA)).entrees).toEqual([]);
    expect((await lister(U.patronB)).entrees).toEqual([]);
    // Un visiteur non connecté n'a même pas le droit d'appeler la fonction.
    await expect(lister(null)).rejects.toThrow(/permission denied/);
  });

  it("pagine par curseur sans trou ni doublon, du plus récent au plus ancien", async () => {
    const tout = (await lister(U.patronA, { limite: 100 })).entrees;
    const vues: number[] = [];
    let apres: { date: string; id: number } | null = null;
    let pages = 0;
    do {
      const p = await lister(U.patronA, { limite: 3, apres });
      expect(p.entrees.length).toBeLessThanOrEqual(3);
      vues.push(...p.entrees.map((e) => e.id));
      apres = p.suivant;
      pages++;
    } while (apres && pages < 50);
    expect(vues).toEqual(tout.map((e) => e.id));
    expect(new Set(vues).size).toBe(vues.length);
    const dates = tout.map((e) => e.cree_le);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("rejette un curseur incomplet", async () => {
    await expect(
      lignes(
        db,
        U.patronA,
        "select lister_journal(null, null, false, null, null, 30, now(), null)",
      ),
    ).rejects.toThrow(/Curseur invalide/);
  });

  it("filtre par alertes, par actions et par période", async () => {
    const alertes = await lister(U.patronA, { alertes: true });
    expect(alertes.entrees.length).toBeGreaterThan(0);
    expect(alertes.entrees.every((e) => e.alerte)).toBe(true);
    const caisse = await lister(U.patronA, {
      actions: ["depense_enregistree"],
    });
    expect(caisse.entrees.map((e) => e.action)).toEqual([
      "depense_enregistree",
    ]);
    const hier = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
    }).format(new Date(Date.now() - 86_400_000));
    expect((await lister(U.patronA, { au: hier })).entrees).toEqual([]);
    const auj = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
    }).format(new Date());
    expect(
      (await lister(U.patronA, { du: auj, au: auj, limite: 100 })).entrees
        .length,
    ).toBeGreaterThan(5);
  });

  it("limite la taille d'une page à 100", async () => {
    const p = await lister(U.patronA, { limite: 100000 });
    expect(p.entrees.length).toBeLessThanOrEqual(100);
  });
});

describe("journal de base (plan Essentiel) et complet", () => {
  it("le plan Essentiel ne voit que ventes, annulations, remises et clôtures ; le complet voit tout", async () => {
    const complet = await lister(U.patronA, { limite: 100 });
    expect(complet.entrees.map((e) => e.action)).toContain(
      "depense_enregistree",
    );
    await db.query(
      "update organisations set plan_code = 'essentiel' where id = $1",
      [f.orgA],
    );
    try {
      const base = await lister(U.patronA, { limite: 100 });
      const permises = new Set(actionsVisibles(false));
      expect(base.entrees.length).toBeGreaterThan(0);
      expect(base.entrees.every((e) => permises.has(e.action))).toBe(true);
      expect(base.entrees.map((e) => e.action)).not.toContain(
        "depense_enregistree",
      );
      // Demander explicitement une action réservée au complet ne la révèle pas.
      const forcee = await lister(U.patronA, {
        actions: actionsDeCategorie("stock", true),
      });
      expect(forcee.entrees).toEqual([]);
    } finally {
      await db.query(
        "update organisations set plan_code = 'business' where id = $1",
        [f.orgA],
      );
    }
  });
});

describe("immuabilité du journal", () => {
  it("aucun update ni delete, même pour le propriétaire ou la clé service_role", async () => {
    await expect(
      lignes(db, U.patronA, "update journal_activite set alerte = false"),
    ).rejects.toThrow();
    await expect(
      lignes(db, U.patronA, "delete from journal_activite"),
    ).rejects.toThrow();
    await expect(
      db.query("update journal_activite set alerte = false"),
    ).rejects.toThrow(/modifi/i);
    await expect(db.query("delete from journal_activite")).rejects.toThrow();
  });
});
