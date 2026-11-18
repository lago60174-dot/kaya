import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

type Fixtures = Awaited<ReturnType<typeof preparer>>;

async function base() {
  const db = await creerBase();
  const f = await preparer(db);
  return { db, f };
}

const jourDouala = async (db: PGlite) =>
  (
    await db.query<{ d: string }>(
      "select (now() at time zone 'Africa/Douala')::date::text as d",
    )
  ).rows[0].d;

const appeler = <T = unknown>(
  db: PGlite,
  user: string,
  sql: string,
  params: unknown[] = [],
) => lignes<{ r: T }>(db, user, `select ${sql} as r`, params);

const entree = (
  db: PGlite,
  boutique: string,
  produit: string,
  quantite: number,
) =>
  appeler(
    db,
    U.patronA,
    "enregistrer_mouvement_stock($1, $2, 'entree', $3)",
    [boutique, produit, quantite],
  );

const vendre = (
  db: PGlite,
  user: string,
  boutique: string,
  produit: string,
  unite: string,
  quantite: number,
  paiements: unknown[] = [{ mode: "especes" }],
  client: string | null = null,
) =>
  appeler(db, user, "creer_vente($1, $2, $3::jsonb, $4::jsonb, $5)", [
    boutique,
    cle(),
    JSON.stringify([{ produit_id: produit, unite_id: unite, quantite }]),
    JSON.stringify(paiements),
    client,
  ]);

describe("creer_boutique", () => {
  let db: PGlite;
  let f: Fixtures;
  beforeAll(async () => {
    ({ db, f } = await base());
  });

  it("le propriétaire d'un plan multi-boutiques ajoute une boutique : réglages créés, visible, journalisée", async () => {
    const r = (
      await appeler<{ id: string; nom: string }>(
        db,
        U.patronA,
        "creer_boutique($1, $2, $3)",
        ["  Boutique Bastos ", "Rue 1.234, Yaoundé", "699111222"],
      )
    )[0].r;
    expect(r.nom).toBe("Boutique Bastos"); // nom nettoyé
    const reglages = await db.query(
      "select 1 from parametres_boutique where boutique_id = $1",
      [r.id],
    );
    expect(reglages.rows).toHaveLength(1);
    const liste = (
      await appeler<{ id: string; en_ecriture: boolean }[]>(
        db,
        U.patronA,
        "lister_boutiques()",
      )
    )[0].r;
    expect(liste).toHaveLength(3);
    expect(liste.every((b) => b.en_ecriture)).toBe(true);
    const j = await db.query(
      "select 1 from journal_activite where action = 'boutique_creee' and entite_id = $1",
      [r.id],
    );
    expect(j.rows).toHaveLength(1);
  });

  it("refuse un vendeur, un nom vide ou en double (sans tenir compte de la casse), un nom trop long", async () => {
    await expect(
      appeler(db, U.vendeurA, "creer_boutique($1)", ["Nouvelle"]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await expect(
      appeler(db, U.patronA, "creer_boutique($1)", ["   "]),
    ).rejects.toThrow(/nom de la boutique/);
    await expect(
      appeler(db, U.patronA, "creer_boutique($1)", ["boutique a2"]),
    ).rejects.toThrow(/déjà une boutique avec ce nom/);
    await expect(
      appeler(db, U.patronA, "creer_boutique($1)", ["x".repeat(81)]),
    ).rejects.toThrow(/trop long/);
  });

  it("un plan sans multi-boutiques (Essentiel) ne peut pas en ajouter, même en appelant la base directement", async () => {
    await expect(
      appeler(db, U.patronB, "creer_boutique($1)", ["Deuxième"]),
    ).rejects.toThrow(/pas incluse dans votre abonnement/);
    const n = await db.query(
      "select count(*)::int as n from boutiques where organisation_id = $1",
      [f.orgB],
    );
    expect(n.rows[0]).toEqual({ n: 1 });
  });

  it("respecte la limite de boutiques du plan", async () => {
    await db.query(
      `update plans set limites = '{"vendeurs":null,"boutiques":4}'::jsonb where code = 'business'`,
    );
    // 3 boutiques existent déjà (A, A2, Bastos) : une 4e passe, la 5e est refusée.
    await appeler(db, U.patronA, "creer_boutique($1)", ["Quatrième"]);
    await expect(
      appeler(db, U.patronA, "creer_boutique($1)", ["Cinquième"]),
    ).rejects.toThrow(/permet 4 boutiques/);
    await db.query(
      `update plans set limites = '{"vendeurs":null,"boutiques":null}'::jsonb where code = 'business'`,
    );
  });

  it("refuse la création quand le compte est suspendu (lecture seule)", async () => {
    await db.query(
      "update abonnements set statut = 'suspendu' where organisation_id = $1",
      [f.orgA],
    );
    await expect(
      appeler(db, U.patronA, "creer_boutique($1)", ["Pendant suspension"]),
    ).rejects.toThrow(/lecture seule/);
    await db.query(
      "update abonnements set statut = 'actif' where organisation_id = $1",
      [f.orgA],
    );
  });
});

describe("isolation entre boutiques et entre organisations", () => {
  let db: PGlite;
  let f: Fixtures;
  beforeAll(async () => {
    ({ db, f } = await base());
    await entree(db, f.boutiqueA2, f.ciment.id, 1);
  });

  it("un vendeur ne voit et n'utilise que ses boutiques", async () => {
    const liste = (
      await appeler<{ id: string }[]>(db, U.vendeurA, "lister_boutiques()")
    )[0].r;
    expect(liste.map((b) => b.id)).toEqual([f.boutiqueA]);
    await expect(
      appeler(db, U.vendeurA, "enregistrer_mouvement_stock($1, $2, 'entree', 1)", [
        f.boutiqueA2,
        f.clous.id,
      ]),
    ).rejects.toThrow(/Accès refusé/);
    const stock = await lignes(
      db,
      U.vendeurA,
      "select * from stock_courant where boutique_id = $1",
      [f.boutiqueA2],
    );
    expect(stock).toHaveLength(0); // la RLS masque l'autre boutique
  });

  it("le propriétaire voit toutes les boutiques de son organisation, jamais celles d'une autre", async () => {
    const a = (
      await appeler<{ id: string }[]>(db, U.patronA, "lister_boutiques()")
    )[0].r;
    expect(a.map((b) => b.id).sort()).toEqual(
      [f.boutiqueA, f.boutiqueA2].sort(),
    );
    const b = (
      await appeler<{ id: string }[]>(db, U.patronB, "lister_boutiques()")
    )[0].r;
    expect(b.map((x) => x.id)).toEqual([f.boutiqueB]);
    await expect(
      appeler(db, U.patronB, "enregistrer_mouvement_stock($1, $2, 'entree', 1)", [
        f.boutiqueA2,
        f.ciment.id,
      ]),
    ).rejects.toThrow(/Boutique introuvable/);
  });

  it("le propriétaire attribue des boutiques à un vendeur, qui peut alors y travailler ; c'est journalisé", async () => {
    const vendeur = (
      await db.query<{ id: string }>(
        "select id from membres where utilisateur_id = $1",
        [U.vendeurA],
      )
    ).rows[0].id;
    await appeler(db, U.patronA, "definir_boutiques_vendeur($1, $2)", [
      vendeur,
      [f.boutiqueA, f.boutiqueA2, f.boutiqueA], // doublon ignoré
    ]);
    const m = await db.query<{ boutiques_autorisees: string[] }>(
      "select boutiques_autorisees from membres where id = $1",
      [vendeur],
    );
    expect(m.rows[0].boutiques_autorisees.sort()).toEqual(
      [f.boutiqueA, f.boutiqueA2].sort(),
    );
    await appeler(
      db,
      U.vendeurA,
      "enregistrer_depense($1, 'transport', 1000, 'especes', 'taxi', $2)",
      [f.boutiqueA2, cle()],
    );
    const j = await db.query(
      "select details from journal_activite where action = 'vendeur_boutiques_modifiees'",
    );
    expect(j.rows).toHaveLength(1);
  });

  it("refuse : un vendeur qui s'attribue des boutiques, une liste vide, une boutique d'une autre organisation, un vendeur d'une autre organisation", async () => {
    const vendeur = (
      await db.query<{ id: string }>(
        "select id from membres where utilisateur_id = $1",
        [U.vendeurA],
      )
    ).rows[0].id;
    await expect(
      appeler(db, U.vendeurA, "definir_boutiques_vendeur($1, $2)", [
        vendeur,
        [f.boutiqueA2],
      ]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await expect(
      appeler(db, U.patronA, "definir_boutiques_vendeur($1, $2)", [vendeur, []]),
    ).rejects.toThrow(/au moins une boutique/);
    await expect(
      appeler(db, U.patronA, "definir_boutiques_vendeur($1, $2)", [
        vendeur,
        [f.boutiqueB],
      ]),
    ).rejects.toThrow(/Boutique introuvable/);
    await expect(
      appeler(db, U.patronB, "definir_boutiques_vendeur($1, $2)", [
        vendeur,
        [f.boutiqueB],
      ]),
    ).rejects.toThrow(/Vendeur introuvable/);
  });
});

describe("stock, caisse, numérotation et crédits entre boutiques", () => {
  let db: PGlite;
  let f: Fixtures;
  let jour: string;
  beforeAll(async () => {
    ({ db, f } = await base());
    jour = await jourDouala(db);
  });

  it("le stock est séparé : pas de vente sans stock dans la 2e boutique, la 1re n'est pas touchée", async () => {
    await expect(
      vendre(db, U.patronA, f.boutiqueA2, f.clous.id, f.clous.unites.kg, 2),
    ).rejects.toThrow(/stock/i);
    await entree(db, f.boutiqueA2, f.clous.id, 3);
    await vendre(db, U.patronA, f.boutiqueA2, f.clous.id, f.clous.unites.kg, 2);
    const s = await db.query<{ boutique_id: string; quantite: string }>(
      "select boutique_id, quantite from stock_courant where produit_id = $1",
      [f.clous.id],
    );
    const parBoutique = Object.fromEntries(
      s.rows.map((r) => [r.boutique_id, Number(r.quantite)]),
    );
    expect(parBoutique[f.boutiqueA]).toBe(10); // intacte
    expect(parBoutique[f.boutiqueA2]).toBe(1);
  });

  it("la numérotation des reçus est indépendante par boutique", async () => {
    await vendre(db, U.patronA, f.boutiqueA, f.clous.id, f.clous.unites.kg, 1);
    const r = await db.query<{ boutique_id: string; numero_recu: string }>(
      "select boutique_id, numero_recu from ventes order by cree_le",
    );
    const numeros = Object.fromEntries(
      r.rows.map((x) => [x.boutique_id, x.numero_recu]),
    );
    expect(numeros[f.boutiqueA]).toMatch(/-000001$/);
    expect(numeros[f.boutiqueA2]).toMatch(/-000001$/);
  });

  it("la caisse est séparée : une dépense de la boutique 1 ne change pas la caisse de la boutique 2", async () => {
    const caisse = async (b: string) =>
      (
        await appeler<{ especes_attendues: number; depenses_total: number }>(
          db,
          U.patronA,
          "calculer_caisse($1, $2::date)",
          [b, jour],
        )
      )[0].r;
    const avant = await caisse(f.boutiqueA2);
    await appeler(
      db,
      U.patronA,
      "enregistrer_depense($1, 'transport', 4000, 'especes', 'livraison', $2)",
      [f.boutiqueA, cle()],
    );
    expect(await caisse(f.boutiqueA2)).toEqual(avant);
    expect((await caisse(f.boutiqueA)).depenses_total).toBe(4000);
    // Chaque boutique se clôture séparément.
    await appeler(db, U.patronA, "cloturer_caisse($1, $2::date, 0)", [
      f.boutiqueA,
      jour,
    ]);
    const c = await db.query(
      "select boutique_id from clotures_caisse where date = $1::date",
      [jour],
    );
    expect(c.rows).toEqual([{ boutique_id: f.boutiqueA }]);
  });

  it("le plafond de crédit d'un client compte ses dettes de TOUTES les boutiques ; le remboursement reste lié à la boutique du crédit", async () => {
    await db.query("update clients set plafond_credit = 10000 where id = $1", [
      f.client,
    ]);
    await entree(db, f.boutiqueA2, f.clous.id, 20);
    // 5 kg à 1 200 = 6 000 FCFA à crédit dans chaque boutique : le 2e dépasse le plafond global de 10 000.
    await vendre(
      db,
      U.patronA,
      f.boutiqueA,
      f.clous.id,
      f.clous.unites.kg,
      5,
      [], // aucun paiement : tout est à crédit
      f.client,
    );
    await expect(
      vendre(
        db,
        U.patronA,
        f.boutiqueA2,
        f.clous.id,
        f.clous.unites.kg,
        5,
        [], // aucun paiement : tout est à crédit
        f.client,
      ),
    ).rejects.toThrow(/Plafond de crédit dépassé/);
    // Le crédit a été accordé dans la boutique 1 : on ne le rembourse pas dans la boutique 2.
    await expect(
      appeler(db, U.patronA, "rembourser_client($1, $2, 1000, 'especes', $3)", [
        f.boutiqueA2,
        f.client,
        cle(),
      ]),
    ).rejects.toThrow(/ne doit rien/);
    await appeler(db, U.patronA, "rembourser_client($1, $2, 1000, 'especes', $3)", [
      f.boutiqueA,
      f.client,
      cle(),
    ]);
  });
});

describe("tableau_de_bord_consolide", () => {
  let db: PGlite;
  let f: Fixtures;
  beforeAll(async () => {
    ({ db, f } = await base());
    await entree(db, f.boutiqueA2, f.clous.id, 10);
    await vendre(db, U.patronA, f.boutiqueA, f.clous.id, f.clous.unites.kg, 2); // 2 400
    await vendre(db, U.patronA, f.boutiqueA2, f.clous.id, f.clous.unites.kg, 3); // 3 600
  });

  it("donne une ligne par boutique avec les chiffres de chacune", async () => {
    const r = (
      await appeler<{
        boutiques: { boutique_id: string; ventes_total: number; nb_ventes: number }[];
      }>(db, U.patronA, "tableau_de_bord_consolide()")
    )[0].r;
    expect(r.boutiques).toHaveLength(2);
    const par = Object.fromEntries(r.boutiques.map((b) => [b.boutique_id, b]));
    expect(par[f.boutiqueA].ventes_total).toBe(2400);
    expect(par[f.boutiqueA2].ventes_total).toBe(3600);
    expect(par[f.boutiqueA2].nb_ventes).toBe(1);
  });

  it("est réservé au propriétaire et ne montre jamais une autre organisation", async () => {
    await expect(
      appeler(db, U.vendeurA, "tableau_de_bord_consolide()"),
    ).rejects.toThrow(/réservé au propriétaire/);
    const b = (
      await appeler<{ boutiques: { boutique_id: string }[] }>(
        db,
        U.patronB,
        "tableau_de_bord_consolide()",
      )
    )[0].r;
    expect(b.boutiques.map((x) => x.boutique_id)).toEqual([f.boutiqueB]);
  });
});

describe("boutiques au-delà du plan : lecture seule, rien n'est supprimé", () => {
  let db: PGlite;
  let f: Fixtures;
  beforeAll(async () => {
    ({ db, f } = await base());
    await entree(db, f.boutiqueA2, f.clous.id, 10);
    await vendre(db, U.patronA, f.boutiqueA2, f.clous.id, f.clous.unites.kg, 1);
  });

  const limiter = (n: number | null) =>
    db.query(
      `update plans set limites = jsonb_build_object('vendeurs', null, 'boutiques', $1::int) where code = 'business'`,
      [n],
    );

  it("après une descente de plan à 1 boutique, la plus récente est en lecture seule et la plus ancienne continue", async () => {
    await limiter(1);
    const liste = (
      await appeler<{ id: string; en_ecriture: boolean }[]>(
        db,
        U.patronA,
        "lister_boutiques()",
      )
    )[0].r;
    expect(Object.fromEntries(liste.map((b) => [b.id, b.en_ecriture]))).toEqual(
      { [f.boutiqueA]: true, [f.boutiqueA2]: false },
    );
    // Écritures refusées dans la boutique hors plan (vente, dépense, stock)…
    await expect(
      vendre(db, U.patronA, f.boutiqueA2, f.clous.id, f.clous.unites.kg, 1),
    ).rejects.toThrow(/lecture seule/);
    await expect(
      appeler(
        db,
        U.patronA,
        "enregistrer_depense($1, 'transport', 500, 'especes', 'x', $2)",
        [f.boutiqueA2, cle()],
      ),
    ).rejects.toThrow(/lecture seule/);
    await expect(entree(db, f.boutiqueA2, f.clous.id, 1)).rejects.toThrow(
      /lecture seule/,
    );
    // … mais la lecture et l'historique restent disponibles, et la boutique dans le plan fonctionne.
    const ventes = await lignes(
      db,
      U.patronA,
      "select id from ventes where boutique_id = $1",
      [f.boutiqueA2],
    );
    expect(ventes).toHaveLength(1);
    await vendre(db, U.patronA, f.boutiqueA, f.clous.id, f.clous.unites.kg, 1);
  });

  it("remonter de plan réactive la boutique, sans perte de donnée", async () => {
    await limiter(null);
    await vendre(db, U.patronA, f.boutiqueA2, f.clous.id, f.clous.unites.kg, 1);
    const n = await db.query<{ n: number }>(
      "select count(*)::int as n from ventes where boutique_id = $1",
      [f.boutiqueA2],
    );
    expect(n.rows[0].n).toBe(2);
  });
});

describe("résumé WhatsApp quotidien avec plusieurs boutiques", () => {
  it("porte le nom de l'organisation et compte le stock bas boutique par boutique", async () => {
    const { db, f } = await base();
    // Ciment : seuil 100 kg, 250 kg en boutique 1, 0 en boutique 2. Sur le total (250) il n'est « pas bas », mais il l'est en boutique 2.
    await db.query("update organisations set telephone = '699000111' where id = $1", [
      f.orgA,
    ]);
    await db.query(
      "update abonnements set statut = 'actif' where organisation_id = $1",
      [f.orgA],
    );
    await db.query(
      "insert into resume_whatsapp_reglages (organisation_id, actif) values ($1, true)",
      [f.orgA],
    );
    const r = await db.query<{ boutique_nom: string; stock_bas: number }>(
      "select boutique_nom, stock_bas from reserver_resumes() where organisation_id = $1",
      [f.orgA],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].boutique_nom).toBe("Org A (2 boutiques)");
    expect(Number(r.rows[0].stock_bas)).toBe(1);
  });
});
