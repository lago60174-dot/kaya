import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, en, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;

const ID = (n: number) =>
  `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const AFFILIE = ID(1);
const AFFILIE_AUTO = ID(3);
const ADMIN = ID(2);
const nouvelUtilisateur = (id: string) =>
  db.query("insert into auth.users (id, email) values ($1, $2)", [
    id,
    `${id}@test.dev`,
  ]);
const un = async (sql: string, p: unknown[] = []) =>
  Object.values((await db.query<Record<string, unknown>>(sql, p)).rows[0])[0];
const creer = (user: string, ...args: (string | null)[]) =>
  lignes<{ r: Record<string, string> }>(
    db,
    user,
    "select creer_organisation($1, $2, $3, $4, $5, $6) as r",
    [
      "Boutique",
      "Ma boutique",
      args[0] ?? null,
      args[1] ?? null,
      args[2] ?? null,
      args[3] ?? "lien",
    ],
  );

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
  await nouvelUtilisateur(AFFILIE);
  await nouvelUtilisateur(ADMIN);
  await nouvelUtilisateur(AFFILIE_AUTO);
  await db.query(
    "insert into affilies (utilisateur_id, nom, email, code, telephone, actif) values ($1, 'Auto', 'auto@test.dev', 'SELF01', '+237699000002', true)",
    [AFFILIE_AUTO],
  );
  await db.query(
    "insert into administrateurs_plateforme (utilisateur_id) values ($1)",
    [ADMIN],
  );
  await db.query(
    "insert into affilies (utilisateur_id, nom, email, code, telephone, actif) values ($1, 'Partenaire', 'part@test.dev', 'PARTN1', '+237699000001', true)",
    [AFFILIE],
  );
});

describe("plans et visibilité", () => {
  it("contient les trois plans, seul Essentiel est visible", async () => {
    const r = await db.query<{ code: string; visible_public: boolean }>(
      "select code, visible_public from plans order by ordre",
    );
    expect(r.rows.map((x) => [x.code, x.visible_public])).toEqual([
      ["essentiel", true],
      ["pro", false],
      ["business", false],
    ]);
  });
  it("un visiteur anonyme ne voit que les plans visibles", async () => {
    expect(
      (await lignes<{ code: string }>(db, null, "select code from plans")).map(
        (x) => x.code,
      ),
    ).toEqual(["essentiel"]);
  });
  it("une organisation voit son propre plan, même masqué, jamais celui des autres", async () => {
    const a = (
      await lignes<{ code: string }>(db, U.patronA, "select code from plans")
    )
      .map((x) => x.code)
      .sort();
    expect(a).toEqual(["business", "essentiel"]);
  });
});

describe("peut_utiliser et limite_plan", () => {
  const peut = async (user: string, org: string, fonction: string) =>
    (
      await lignes<{ r: boolean }>(
        db,
        user,
        "select peut_utiliser($1, $2) as r",
        [org, fonction],
      )
    )[0].r;
  const lim = async (user: string, org: string, cle: string) =>
    (
      await lignes<{ r: number | null }>(
        db,
        user,
        "select limite_plan($1, $2) as r",
        [org, cle],
      )
    )[0].r;

  it("Essentiel n'a pas les fonctions avancées, Business les a", async () => {
    expect(await peut(U.patronB, f.orgB, "devis")).toBe(false);
    expect(await peut(U.patronB, f.orgB, "impression")).toBe(false);
    expect(await peut(U.patronA, f.orgA, "devis")).toBe(true);
  });
  it("ne renseigne pas sur l'organisation d'un autre", async () => {
    expect(await peut(U.patronB, f.orgA, "devis")).toBe(false);
    expect(await lim(U.patronB, f.orgA, "vendeurs")).toBe(0);
  });
  it("limites : 1 vendeur pour Essentiel, illimité pour Business, clé inconnue = 0", async () => {
    expect(await lim(U.patronB, f.orgB, "vendeurs")).toBe(1);
    expect(await lim(U.patronA, f.orgA, "vendeurs")).toBeNull();
    expect(await lim(U.patronB, f.orgB, "inconnue")).toBe(0);
  });
});

describe("limites contrôlées à la création (même avec la clé service_role)", () => {
  it("refuse un 2e vendeur sur Essentiel, accepte après désactivation", async () => {
    const [v1, v2] = [ID(10), ID(11)];
    await nouvelUtilisateur(v1);
    await nouvelUtilisateur(v2);
    const ajout = (id: string) =>
      db.query(
        "insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees) values ($1, $2, 'vendeur', $3)",
        [id, f.orgB, [f.boutiqueB]],
      );
    await ajout(v1);
    await expect(ajout(v2)).rejects.toThrow(
      /permet 1 vendeur actif\. Désactivez/,
    );
    await db.query(
      "update membres set actif = false where utilisateur_id = $1",
      [v1],
    );
    await ajout(v2);
    await expect(
      db.query("update membres set actif = true where utilisateur_id = $1", [
        v1,
      ]),
    ).rejects.toThrow(/permet 1 vendeur/);
  });
  it("refuse une 2e boutique sur Essentiel, l'accepte sur Business", async () => {
    await expect(
      db.query(
        "insert into boutiques (organisation_id, nom) values ($1, 'B2')",
        [f.orgB],
      ),
    ).rejects.toThrow(/permet 1 boutique\./);
    await db.query(
      "insert into boutiques (organisation_id, nom) values ($1, 'A3')",
      [f.orgA],
    );
  });
});

describe("compte suspendu : lecture seule", () => {
  it("bloque les ventes et les écritures directes, garde la lecture", async () => {
    await db.query(
      "update abonnements set statut = 'suspendu' where organisation_id = $1",
      [f.orgB],
    );
    await expect(
      lignes(db, U.patronB, "select creer_vente($1, $2, '[]'::jsonb)", [
        f.boutiqueB,
        cle(),
      ]),
    ).rejects.toThrow(/lecture seule/);
    await expect(
      lignes(
        db,
        U.patronB,
        "insert into categories (organisation_id, nom) values ($1, 'X')",
        [f.orgB],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (await lignes(db, U.patronB, "select 1 from boutiques")).length,
    ).toBe(1);
    await db.query(
      "update abonnements set statut = 'actif' where organisation_id = $1",
      [f.orgB],
    );
    await lignes(
      db,
      U.patronB,
      "insert into categories (organisation_id, nom) values ($1, 'Outils')",
      [f.orgB],
    );
  });
});

describe("journal de base ou complet selon le plan", () => {
  it("Essentiel ne voit que les actions de base, Pro voit tout", async () => {
    for (const a of [
      "vente_creee",
      "stock_bas",
      "remise_elevee",
      "stock_perte",
    ]) {
      await db.query("select ecrire_journal($1, $2, $3, 'x', null, '{}')", [
        f.orgB,
        f.boutiqueB,
        a,
      ]);
    }
    const vu = async () =>
      (
        await lignes<{ action: string }>(
          db,
          U.patronB,
          "select action from journal_activite",
        )
      )
        .map((x) => x.action)
        .sort();
    expect(await vu()).toEqual(["remise_elevee", "vente_creee"]);
    await db.query("update organisations set plan_code = 'pro' where id = $1", [
      f.orgB,
    ]);
    expect(await vu()).toContain("stock_bas");
    await db.query(
      "update organisations set plan_code = 'essentiel' where id = $1",
      [f.orgB],
    );
  });
});

describe("parrainage à l'inscription", () => {
  const parrainages = async (org: string) =>
    Number(
      await un("select count(*) from parrainages where organisation_id = $1", [
        org,
      ]),
    );

  it("enregistre le parrainage avec un code valide (insensible à la casse)", async () => {
    await nouvelUtilisateur(ID(20));
    const r = (
      await creer(ID(20), "Yaoundé", "+237677111111", " partn1 ", "code")
    )[0].r;
    expect(await parrainages(r.organisation_id)).toBe(1);
    expect(
      await un("select source from parrainages where organisation_id = $1", [
        r.organisation_id,
      ]),
    ).toBe("code");
  });
  it("ignore un code inconnu sans bloquer l'inscription", async () => {
    await nouvelUtilisateur(ID(21));
    const r = (await creer(ID(21), "Douala", "+237677222222", "ZZZZ99"))[0].r;
    expect(await parrainages(r.organisation_id)).toBe(0);
  });
  it("refuse l'auto-parrainage (même compte, même téléphone, même email) et le signale", async () => {
    await nouvelUtilisateur(ID(22));
    const parTel = (await creer(ID(22), "Douala", "+237699000001", "PARTN1"))[0]
      .r;
    expect(await parrainages(parTel.organisation_id)).toBe(0);
    const parCompte = (
      await creer(AFFILIE_AUTO, "Douala", "+237655000000", "SELF01")
    )[0].r;
    expect(await parrainages(parCompte.organisation_id)).toBe(0);
    await db.query(
      "insert into auth.users (id, email) values ($1, 'part@test.dev')",
      [ID(23)],
    );
    const parEmail = (
      await creer(ID(23), "Douala", "+237655000001", "PARTN1")
    )[0].r;
    expect(await parrainages(parEmail.organisation_id)).toBe(0);
    expect(
      Number(
        await un(
          "select count(*) from journal_activite where action = 'auto_parrainage_refuse'",
        ),
      ),
    ).toBe(3);
  });
  it("ne rattache pas un affilié non validé", async () => {
    await db.query("update affilies set actif = false");
    await nouvelUtilisateur(ID(24));
    const r = (await creer(ID(24), "Douala", "+237677333333", "PARTN1"))[0].r;
    expect(await parrainages(r.organisation_id)).toBe(0);
    await db.query("update affilies set actif = true");
  });
});

describe("accès des affiliés, de l'administrateur et des propriétaires", () => {
  it("l'affilié voit ses parrainages mais aucune donnée de quincaillerie", async () => {
    expect(
      (await lignes(db, AFFILIE, "select 1 from parrainages")).length,
    ).toBe(1);
    for (const t of [
      "organisations",
      "boutiques",
      "ventes",
      "produits",
      "clients",
      "membres",
      "abonnements",
    ]) {
      expect(await lignes(db, AFFILIE, `select 1 from ${t}`)).toHaveLength(0);
    }
  });
  it("un propriétaire ne voit ni les affiliés, ni les commissions, ni les tables de plateforme", async () => {
    for (const t of [
      "affilies",
      "parrainages",
      "commissions",
      "versements_affilies",
      "evenements_paiement",
      "envois_whatsapp",
      "parametres_plateforme",
      "journal_audit",
      "administrateurs_plateforme",
    ]) {
      expect(await lignes(db, U.patronA, `select 1 from ${t}`)).toHaveLength(0);
    }
  });
  it("un propriétaire ne voit que son abonnement", async () => {
    expect(
      await lignes(db, U.patronA, "select 1 from abonnements"),
    ).toHaveLength(1);
    expect(
      await lignes(db, U.vendeurA, "select 1 from abonnements"),
    ).toHaveLength(0);
  });
  it("l'administrateur voit les abonnements et les affiliés, mais pas les ventes", async () => {
    expect(
      (await lignes(db, ADMIN, "select 1 from abonnements")).length,
    ).toBeGreaterThanOrEqual(2);
    expect((await lignes(db, ADMIN, "select 1 from affilies")).length).toBe(2);
    expect(await lignes(db, ADMIN, "select 1 from ventes")).toHaveLength(0);
  });
  it("personne ne peut écrire dans les tables de plateforme", async () => {
    for (const u of [U.patronA, AFFILIE, ADMIN]) {
      await expect(
        en(db, u, () => db.query("update plans set visible_public = true")),
      ).rejects.toThrow(/permission denied/);
      await expect(
        en(db, u, () =>
          db.query(
            "insert into administrateurs_plateforme (utilisateur_id) values ($1)",
            [u],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe("garanties de l'affiliation et de l'audit", () => {
  it("une même facture ne génère jamais deux commissions", async () => {
    const abo = await un(
      "select id from abonnements where organisation_id = $1",
      [f.orgB],
    );
    const fac = await un(
      "insert into factures_abonnement (organisation_id, abonnement_id, type, montant_brut, frais_paiement, mode) values ($1, $2, 'abonnement', 5000, 150, 'fapshi') returning id",
      [f.orgB, abo],
    );
    expect(
      await un("select montant_net from factures_abonnement where id = $1", [
        fac,
      ]),
    ).toBe(4850);
    const parr = await un("select id from parrainages limit 1");
    const aff = await un("select id from affilies limit 1");
    const ajout = () =>
      db.query(
        "insert into commissions (affilie_id, parrainage_id, facture_id, montant, pourcentage, disponible_le) values ($1, $2, $3, 970, 20, now())",
        [aff, parr, fac],
      );
    await ajout();
    await expect(ajout()).rejects.toThrow(/unique|duplicate/i);
  });
  it("le journal d'audit et les versements ne se modifient jamais", async () => {
    await db.query("insert into journal_audit (action) values ('test')");
    await expect(
      db.query("update journal_audit set action = 'x'"),
    ).rejects.toThrow(/jamais être modifié/);
    await expect(db.query("delete from journal_audit")).rejects.toThrow(
      /jamais être modifié/,
    );
  });
});
