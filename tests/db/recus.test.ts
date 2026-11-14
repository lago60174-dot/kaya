import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;
const ventes: { id: string; numero: string; jeton: string }[] = [];

type Liste = {
  recus: {
    id: string;
    numero_recu: string;
    statut: string;
    total: number;
    client_nom: string | null;
    credit: number;
    vendeur_nom: string | null;
  }[];
  suivant: { date: string; id: string } | null;
};
const lister = (
  user: string,
  boutique: string,
  o: Record<string, unknown> = {},
) =>
  lignes<{ r: Liste }>(
    db,
    user,
    "select lister_recus($1, $2, $3, $4, $5, $6, $7, $8, $9) as r",
    [
      boutique,
      o.q ?? null,
      o.statut ?? null,
      o.vendeur ?? null,
      o.du ?? null,
      o.au ?? null,
      o.limite ?? 30,
      o.apresDate ?? null,
      o.apresId ?? null,
    ],
  ).then((r) => r[0].r);
const publique = async (jeton: string | null) =>
  (
    await lignes<{ r: Record<string, unknown> | null }>(
      db,
      null,
      "select recu_public($1) as r",
      [jeton],
    )
  )[0].r;

async function vendre(
  user: string,
  paiements: object[],
  client: string | null = null,
  q = 1,
) {
  const r = (
    await lignes<{
      r: { vente_id: string; numero_recu: string; jeton_public: string };
    }>(db, user, "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5) as r", [
      f.boutiqueA,
      cle(),
      JSON.stringify([
        { produit_id: f.clous.id, unite_id: f.clous.unites.kg, quantite: q },
        { produit_id: f.ciment.id, unite_id: f.ciment.unites.kg, quantite: 1 },
      ]),
      JSON.stringify(paiements),
      client,
    ])
  )[0].r;
  ventes.push({ id: r.vente_id, numero: r.numero_recu, jeton: r.jeton_public });
  return r;
}

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
  await db.query(
    "update clients set telephone = '+237699111111' where id = $1",
    [f.client],
  );
  await db.query(
    "update membres set nom = 'Paul Vendeur' where utilisateur_id = $1",
    [U.vendeurA],
  );
  await vendre(U.vendeurA, [{ mode: "especes" }]); // 1 330
  await vendre(U.patronA, [{ mode: "mtn_momo" }], f.client, 2); // 2 530
  await vendre(U.vendeurA, [{ mode: "especes", montant: 500 }], f.client, 3); // 3 730, crédit 3 230
  for (let i = 0; i < 4; i++)
    await vendre(U.vendeurA, [{ mode: "orange_money" }]);
});

describe("lister_recus", () => {
  it("liste du plus récent au plus ancien, avec client, vendeur et crédit", async () => {
    const r = await lister(U.vendeurA, f.boutiqueA);
    expect(r.recus).toHaveLength(7);
    expect(r.recus[0].numero_recu).toMatch(/000007$/);
    const credit = r.recus.find((x) => x.numero_recu.endsWith("000003"))!;
    expect([
      credit.client_nom,
      Number(credit.credit),
      credit.vendeur_nom,
    ]).toEqual(["Jean Mbarga", 3230, "Paul Vendeur"]);
  });
  it("cherche par numéro, même partiel", async () => {
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "000003" })).recus.map((x) =>
        x.numero_recu.slice(-6),
      ),
    ).toEqual(["000003"]);
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "r-20" })).recus,
    ).toHaveLength(7);
  });
  it("cherche par nom de client sans accents ni casse, ou par téléphone", async () => {
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "MBARGA" })).recus,
    ).toHaveLength(2);
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "699 11 11 11" })).recus,
    ).toHaveLength(2);
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "+237699111111" })).recus,
    ).toHaveLength(2);
  });
  it("cherche par montant exact", async () => {
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "2 530" })).recus.map((x) =>
        Number(x.total),
      ),
    ).toEqual([2530]);
  });
  it("filtre par statut et par vendeur", async () => {
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { statut: "annulee" })).recus,
    ).toHaveLength(0);
    expect(
      (await lister(U.patronA, f.boutiqueA, { vendeur: U.patronA })).recus,
    ).toHaveLength(1);
    expect(
      (await lister(U.patronA, f.boutiqueA, { vendeur: U.vendeurA })).recus,
    ).toHaveLength(6);
    await expect(
      lister(U.vendeurA, f.boutiqueA, { statut: "autre" }),
    ).rejects.toThrow(/Statut invalide/);
  });
  it("filtre par dates (jours de Douala)", async () => {
    const jour = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
    }).format(new Date());
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { du: jour, au: jour })).recus,
    ).toHaveLength(7);
    expect(
      (
        await lister(U.vendeurA, f.boutiqueA, {
          du: "2000-01-01",
          au: "2000-01-02",
        })
      ).recus,
    ).toHaveLength(0);
  });
  it("pagine par curseur sans doublon ni oubli", async () => {
    const vus: string[] = [];
    let page = await lister(U.vendeurA, f.boutiqueA, { limite: 3 });
    for (;;) {
      expect(page.recus.length).toBeLessThanOrEqual(3);
      vus.push(...page.recus.map((x) => x.numero_recu));
      if (!page.suivant) break;
      page = await lister(U.vendeurA, f.boutiqueA, {
        limite: 3,
        apresDate: page.suivant.date,
        apresId: page.suivant.id,
      });
    }
    expect(vus).toEqual(ventes.map((v) => v.numero).reverse());
  });
  it("refuse une boutique non autorisée ou d'une autre organisation", async () => {
    await expect(lister(U.vendeurA, f.boutiqueA2)).rejects.toThrow(
      /Accès refusé/,
    );
    await expect(lister(U.patronB, f.boutiqueA)).rejects.toThrow(
      /Accès refusé/,
    );
  });
  it("traite % comme un caractère ordinaire", async () => {
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { q: "%" })).recus,
    ).toHaveLength(0);
  });
});

describe("aucun reçu ne peut être modifié ni supprimé, par aucun rôle", () => {
  it("même le propriétaire et la clé service_role sont arrêtés par la base", async () => {
    await expect(
      lignes(db, U.patronA, "update ventes set total = 1"),
    ).rejects.toThrow(/permission denied/);
    await expect(lignes(db, U.patronA, "delete from ventes")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("update ventes set total = 1")).rejects.toThrow(
      /ne peut pas être modifiée/,
    );
    await expect(db.query("delete from ventes")).rejects.toThrow(
      /Suppression interdite/,
    );
    await expect(
      db.query("update vente_lignes set total_ligne = 1"),
    ).rejects.toThrow(/jamais être modifié/);
  });
});

describe("annulation et historique", () => {
  it("une vente annulée reste dans la liste, marquée annulée, avec son avoir", async () => {
    const cible = ventes[3];
    await lignes(
      db,
      U.patronA,
      "select annuler_vente($1, 'Erreur de caisse')",
      [cible.id],
    );
    const r = await lister(U.vendeurA, f.boutiqueA);
    expect(r.recus).toHaveLength(7);
    expect(r.recus.find((x) => x.numero_recu === cible.numero)?.statut).toBe(
      "annulee",
    );
    expect(
      (await lister(U.vendeurA, f.boutiqueA, { statut: "annulee" })).recus,
    ).toHaveLength(1);
    const avoir = await lignes<{ numero: string; motif: string }>(
      db,
      U.vendeurA,
      "select numero, motif from avoirs where vente_id = $1",
      [cible.id],
    );
    expect(avoir[0].motif).toBe("Erreur de caisse");
    expect(avoir[0].numero).toMatch(/^A-\d{4}-000001$/);
  });
});

describe("logo de la boutique", () => {
  const LOGO = () => `${f.orgA}/${"b".repeat(64)}-l.png`;
  const definir = (
    utilisateur: (typeof U)[keyof typeof U],
    cle: string | null,
  ) =>
    lignes(db, utilisateur, "select definir_logo_boutique($1, $2)", [
      f.boutiqueA,
      cle,
    ]);
  const logoActuel = async () =>
    (
      await lignes<{ logo_cle: string | null }>(
        db,
        U.patronA,
        "select logo_cle from boutiques where id = $1",
        [f.boutiqueA],
      )
    )[0].logo_cle;

  it("le propriétaire l'enregistre, il apparaît dans le reçu public, et c'est journalisé", async () => {
    await definir(U.patronA, LOGO());
    const r = (await publique(ventes[2].jeton))!;
    expect((r.boutique as { logo_cle: string }).logo_cle).toBe(LOGO());
    const journal = await lignes<{ details: { champs: string[] } }>(
      db,
      U.patronA,
      "select details from journal_activite where action = 'parametres_modifies' and details->'champs' ? 'logo'",
    );
    expect(journal.length).toBeGreaterThan(0);
  });
  it("le vendeur ne peut pas le changer", async () => {
    await expect(definir(U.vendeurA, null)).rejects.toThrow(/propriétaire/);
    expect(await logoActuel()).toBe(LOGO());
  });
  it("l'écriture directe sur boutiques n'existe plus, même pour le propriétaire", async () => {
    await expect(
      lignes(
        db,
        U.patronA,
        "update boutiques set logo_cle = null where id = $1",
        [f.boutiqueA],
      ),
    ).rejects.toThrow();
    expect(await logoActuel()).toBe(LOGO());
  });
  it("refuse une clé qui n'a pas la forme d'un logo ou qui vient d'une autre organisation (pas de chemin forgé)", async () => {
    for (const mauvaise of [
      "../../secret.png",
      `${f.orgA}/${"b".repeat(64)}.webp`,
      `${f.orgB}/${"b".repeat(64)}-l.png`,
      "x",
    ])
      await expect(definir(U.patronA, mauvaise)).rejects.toThrow();
    expect(await logoActuel()).toBe(LOGO());
  });
  it("une clé identique ne change rien et n'écrit pas au journal", async () => {
    const avant = await lignes<{ n: string }>(
      db,
      U.patronA,
      "select count(*)::text as n from journal_activite where action = 'parametres_modifies'",
    );
    await definir(U.patronA, LOGO());
    const apres = await lignes<{ n: string }>(
      db,
      U.patronA,
      "select count(*)::text as n from journal_activite where action = 'parametres_modifies'",
    );
    expect(apres[0].n).toBe(avant[0].n);
  });
});

describe("recu_public", () => {
  it("donne le reçu à n'importe qui avec le bon jeton, sans connexion", async () => {
    const r = (await publique(ventes[2].jeton))!;
    expect(r).toMatchObject({
      numero_recu: ventes[2].numero,
      annule: false,
      total: 3730,
      credit: 3230,
      client_nom: "Jean Mbarga",
    });
    expect((r.boutique as { nom: string }).nom).toBe("Boutique A");
    expect((r.lignes as { nom: string }[]).map((l) => l.nom)).toEqual([
      "Clous 3 pouces",
      "Ciment 50 kg",
    ]);
  });
  it("garde l'ordre du panier, pas celui des identifiants de produits", async () => {
    const [{ r }] = await lignes<{ r: { vente_id: string } }>(
      db,
      U.vendeurA,
      'select creer_vente($1, $2, $3::jsonb, \'[{"mode":"especes"}]\') as r',
      [
        f.boutiqueA,
        cle(),
        JSON.stringify([
          {
            produit_id: f.ciment.id,
            unite_id: f.ciment.unites.kg,
            quantite: 1,
          },
          { produit_id: f.clous.id, unite_id: f.clous.unites.kg, quantite: 1 },
        ]),
      ],
    );
    const l = await db.query<{ nom_produit: string }>(
      "select nom_produit from vente_lignes where vente_id = $1 order by ordre",
      [r.vente_id],
    );
    expect(l.rows.map((x) => x.nom_produit)).toEqual([
      "Ciment 50 kg",
      "Clous 3 pouces",
    ]);
  });
  it("ne contient ni marge, ni prix d'achat, ni téléphone, ni identifiants internes", async () => {
    // La clé du logo (dossier = organisation) est le seul identifiant exposé : indispensable pour afficher le logo,
    // et un identifiant d'organisation ne donne aucun accès (RLS). On l'écarte pour contrôler tout le reste.
    const brut = (await publique(ventes[2].jeton))!;
    const boutique = brut.boutique as Record<string, unknown>;
    const texte = JSON.stringify({
      ...brut,
      boutique: { ...boutique, logo_cle: null },
    });
    expect(texte).not.toMatch(
      /cout|marge|prix_achat|699111111|organisation_id|vendeur_id|jeton|client_id/,
    );
    expect(texte).not.toContain(f.orgA);
  });
  it("marque un reçu annulé comme annulé, mais le garde lisible", async () => {
    expect((await publique(ventes[3].jeton))!.annule).toBe(true);
  });
  it("renvoie null pour un jeton faux, trop court, vide ou piégé", async () => {
    for (const j of [
      "a".repeat(64),
      "abc",
      "",
      null,
      "' or '1'='1",
      ventes[0].jeton.toUpperCase(),
    ])
      expect(await publique(j)).toBeNull();
  });
  it("n'ouvre aucun accès aux tables : un visiteur ne peut rien lister", async () => {
    await expect(lignes(db, null, "select 1 from ventes")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      lignes(db, null, "select lister_recus($1)", [f.boutiqueA]),
    ).rejects.toThrow(/permission denied/);
  });
});
