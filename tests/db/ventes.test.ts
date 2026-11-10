import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, en, lignes, preparer, U } from "./helpers";

type F = Awaited<ReturnType<typeof preparer>>;
let db: PGlite;
let f: F;

const vendre = (
  user: string,
  l: { produit: string; unite: string; q: number; remise?: number }[],
  opts: {
    paiements?: unknown[];
    client?: string | null;
    remise?: number;
    forcer?: boolean;
    cle?: string;
    boutique?: string;
  } = {},
) =>
  lignes<{ r: Record<string, unknown> }>(
    db,
    user,
    "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7) as r",
    [
      opts.boutique ?? f.boutiqueA,
      opts.cle ?? cle(),
      JSON.stringify(
        l.map((x) => ({
          produit_id: x.produit,
          unite_id: x.unite,
          quantite: x.q,
          remise_ligne: x.remise,
        })),
      ),
      JSON.stringify(opts.paiements ?? [{ mode: "especes" }]),
      opts.client ?? null,
      opts.remise ?? 0,
      opts.forcer ?? false,
    ],
  ).then((x) => x[0].r);

const stock = async (produit: string) =>
  Number(
    (
      await db.query<{ quantite: string }>(
        "select quantite from stock_courant where produit_id = $1",
        [produit],
      )
    ).rows[0].quantite,
  );
const compte = async (table: string) =>
  Number(
    (await db.query<{ n: string }>(`select count(*) n from ${table}`)).rows[0]
      .n,
  );

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
});

describe("creer_vente", () => {
  it("vendre 1 kg d'un produit en sacs de 50 kg baisse le stock de 0,02 sac", async () => {
    const avant = await stock(f.ciment.id);
    const r = await vendre(U.vendeurA, [
      { produit: f.ciment.id, unite: f.ciment.unites.kg, q: 1 },
    ]);
    expect(r.total).toBe(130);
    expect(avant - (await stock(f.ciment.id))).toBe(1);
    expect(1 / 50).toBe(0.02);
  });

  it("numérote les reçus sans trou : R-année-000001, 000002…", async () => {
    const r = await vendre(U.vendeurA, [
      { produit: f.clous.id, unite: f.clous.unites.kg, q: 2 },
    ]);
    const annee = new Date().getUTCFullYear();
    expect(r.numero_recu).toBe(`R-${annee}-000002`);
  });

  it("recalcule les prix depuis la base (le client n'envoie aucun prix)", async () => {
    const r = await vendre(U.vendeurA, [
      { produit: f.ciment.id, unite: f.ciment.unites.sac, q: 1 },
    ]);
    expect(r.total).toBe(5500);
  });

  it("est idempotente : la même clé ne crée pas de doublon", async () => {
    const k = cle();
    const l = [{ produit: f.clous.id, unite: f.clous.unites.kg, q: 1 }];
    const a = await vendre(U.vendeurA, l, { cle: k });
    const avant = await compte("ventes");
    const b = await vendre(U.vendeurA, l, { cle: k });
    expect(b.vente_id).toBe(a.vente_id);
    expect(b.deja_enregistree).toBe(true);
    expect(await compte("ventes")).toBe(avant);
  });

  it("refuse un stock insuffisant et n'écrit rien (même pas le numéro de reçu)", async () => {
    const ventes = await compte("ventes");
    const numero = (
      await db.query<{ dernier: number }>(
        "select dernier from compteurs_recus where type = 'recu'",
      )
    ).rows[0].dernier;
    await expect(
      vendre(U.vendeurA, [
        { produit: f.clous.id, unite: f.clous.unites.kg, q: 999 },
      ]),
    ).rejects.toThrow(/Stock insuffisant/);
    expect(await compte("ventes")).toBe(ventes);
    expect(
      (
        await db.query<{ dernier: number }>(
          "select dernier from compteurs_recus where type = 'recu'",
        )
      ).rows[0].dernier,
    ).toBe(numero);
  });

  it("deux ventes successives du dernier article : la seconde est refusée", async () => {
    const reste = await stock(f.clous.id);
    await vendre(U.vendeurA, [
      { produit: f.clous.id, unite: f.clous.unites.kg, q: reste },
    ]);
    await expect(
      vendre(U.vendeurA, [
        { produit: f.clous.id, unite: f.clous.unites.kg, q: 1 },
      ]),
    ).rejects.toThrow(/Stock insuffisant/);
    expect(await stock(f.clous.id)).toBe(0);
  });

  it("accepte le stock négatif si autorisé, avec une alerte", async () => {
    await db.query(
      "update parametres_boutique set stock_negatif_autorise = true where boutique_id = $1",
      [f.boutiqueA],
    );
    await vendre(U.vendeurA, [
      { produit: f.clous.id, unite: f.clous.unites.kg, q: 1 },
    ]);
    expect(await stock(f.clous.id)).toBe(-1);
    const alertes = await db.query(
      "select 1 from journal_activite where action = 'stock_negatif' and alerte",
    );
    expect(alertes.rows.length).toBe(1);
    await db.query(
      "update parametres_boutique set stock_negatif_autorise = false where boutique_id = $1",
      [f.boutiqueA],
    );
  });

  it("limite la remise du vendeur au seuil, pas celle du propriétaire", async () => {
    const l = [{ produit: f.ciment.id, unite: f.ciment.unites.sac, q: 1 }];
    await expect(vendre(U.vendeurA, l, { remise: 1000 })).rejects.toThrow(
      /Remise trop élevée/,
    );
    const ok = await vendre(U.patronA, l, { remise: 1000 });
    expect(ok.total).toBe(4500);
  });

  it("signale une remise supérieure à la moitié du seuil", async () => {
    const l = [{ produit: f.ciment.id, unite: f.ciment.unites.sac, q: 1 }];
    const r = await vendre(U.vendeurA, l, { remise: 200 }); // 3,6 % > 2,5 %
    const a = await db.query(
      "select 1 from journal_activite where action = 'remise_elevee' and entite_id = $1",
      [r.vente_id],
    );
    expect(a.rows.length).toBe(1);
  });

  it("le dernier paiement sans montant prend le reste (paiement mixte)", async () => {
    const r = await vendre(
      U.vendeurA,
      [{ produit: f.ciment.id, unite: f.ciment.unites.sac, q: 1 }],
      { paiements: [{ mode: "especes", montant: 2000 }, { mode: "mtn_momo" }] },
    );
    const p = await db.query<{ mode: string; montant: string }>(
      "select mode, montant from paiements where vente_id = $1 order by montant",
      [r.vente_id],
    );
    expect(p.rows.map((x) => [x.mode, Number(x.montant)])).toEqual([
      ["especes", 2000],
      ["mtn_momo", 3500],
    ]);
  });

  it("refuse un crédit sans client, puis au-delà du plafond sauf si le propriétaire force", async () => {
    await db.query("update produits set seuil_alerte = 0");
    await db.query(
      "update stock_courant set quantite = 100 where produit_id = $1",
      [f.ciment.id],
    );
    const l = [{ produit: f.ciment.id, unite: f.ciment.unites.sac, q: 1 }];
    await expect(vendre(U.vendeurA, l, { paiements: [] })).rejects.toThrow(
      /Choisissez un client/,
    );
    await db.query("update clients set plafond_credit = 6000 where id = $1", [
      f.client,
    ]);
    await vendre(U.vendeurA, l, { paiements: [], client: f.client }); // 5 500 <= 6 000
    await expect(
      vendre(U.vendeurA, l, { paiements: [], client: f.client }),
    ).rejects.toThrow(/Plafond de crédit dépassé/);
    await expect(
      vendre(U.vendeurA, l, { paiements: [], client: f.client, forcer: true }),
    ).rejects.toThrow(/Seul le propriétaire/);
    const ok = await vendre(U.patronA, l, {
      paiements: [],
      client: f.client,
      forcer: true,
    });
    expect(ok.credit).toBe(5500);
  });

  it("refuse un paiement supérieur au total", async () => {
    await expect(
      vendre(
        U.vendeurA,
        [{ produit: f.ciment.id, unite: f.ciment.unites.kg, q: 1 }],
        { paiements: [{ mode: "especes", montant: 500 }] },
      ),
    ).rejects.toThrow(/dépasse le total/);
  });

  it("fige le coût d'achat pour calculer la marge", async () => {
    await db.query(
      "update stock_courant set quantite = 100 where produit_id = $1",
      [f.ciment.id],
    );
    const r = await vendre(U.vendeurA, [
      { produit: f.ciment.id, unite: f.ciment.unites.sac, q: 1 },
    ]);
    const c = await db.query<{ cout_total: string }>(
      "select c.cout_total from vente_lignes_couts c join vente_lignes l on l.id = c.vente_ligne_id where l.vente_id = $1",
      [r.vente_id],
    );
    expect(Number(c.rows[0].cout_total)).toBe(4750); // 50 kg x 95
  });
});

describe("annulation, crédits et caisse", () => {
  let venteId: string;

  beforeAll(async () => {
    await db.query(
      "update stock_courant set quantite = 500 where produit_id = $1",
      [f.ciment.id],
    );
  });

  it("seul le propriétaire annule, avec un motif obligatoire", async () => {
    const r = await vendre(U.vendeurA, [
      { produit: f.ciment.id, unite: f.ciment.unites.sac, q: 2 },
    ]);
    venteId = r.vente_id as string;
    await expect(
      lignes(db, U.vendeurA, "select annuler_vente($1, 'erreur')", [venteId]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await expect(
      lignes(db, U.patronA, "select annuler_vente($1, '  ')", [venteId]),
    ).rejects.toThrow(/motif/);
  });

  it("l'annulation crée un avoir, remet le stock et garde la vente visible", async () => {
    const avant = await stock(f.ciment.id);
    const r = (
      await lignes<{ r: Record<string, unknown> }>(
        db,
        U.patronA,
        "select annuler_vente($1, 'Client parti') as r",
        [venteId],
      )
    )[0].r;
    expect(r.rembourse_especes).toBe(11000);
    expect(await stock(f.ciment.id)).toBe(avant + 100);
    const v = await db.query<{ statut: string }>(
      "select statut from ventes where id = $1",
      [venteId],
    );
    expect(v.rows[0].statut).toBe("annulee");
    await expect(
      lignes(db, U.patronA, "select annuler_vente($1, 'encore')", [venteId]),
    ).rejects.toThrow(/déjà annulée/);
  });

  it("aucun rôle ne peut modifier ou supprimer un reçu, un paiement, un mouvement ou le journal", async () => {
    await expect(
      db.query("update ventes set total = 1 where id = $1", [venteId]),
    ).rejects.toThrow(/ne peut pas être modifiée/);
    await expect(
      db.query("delete from ventes where id = $1", [venteId]),
    ).rejects.toThrow(/Suppression interdite/);
    await expect(db.query("update paiements set montant = 1")).rejects.toThrow(
      /jamais être modifié/,
    );
    await expect(db.query("delete from mouvements_stock")).rejects.toThrow(
      /jamais être modifié/,
    );
    await expect(
      db.query("update journal_activite set alerte = false"),
    ).rejects.toThrow(/jamais être modifié/);
    await expect(db.query("delete from vente_lignes")).rejects.toThrow(
      /jamais être modifié/,
    );
  });

  it("rembourse un crédit partiellement puis totalement, avec reçu de paiement", async () => {
    const c = (
      await db.query<{ id: string; solde: string }>(
        "select id, solde from creances where statut = 'ouverte' limit 1",
      )
    ).rows[0];
    const r1 = (
      await lignes<{ r: Record<string, unknown> }>(
        db,
        U.vendeurA,
        "select enregistrer_remboursement($1, 1000, 'especes') as r",
        [c.id],
      )
    )[0].r;
    expect(r1.solde).toBe(Number(c.solde) - 1000);
    expect(String(r1.numero_recu)).toMatch(/^P-\d{4}-000001$/);
    await expect(
      lignes(
        db,
        U.vendeurA,
        "select enregistrer_remboursement($1, 99999999, 'especes')",
        [c.id],
      ),
    ).rejects.toThrow(/dépasse/);
    await lignes(
      db,
      U.vendeurA,
      "select enregistrer_remboursement($1, $2, 'mtn_momo')",
      [c.id, Number(c.solde) - 1000],
    );
    const fin = await db.query<{ statut: string; solde: string }>(
      "select statut, solde from creances where id = $1",
      [c.id],
    );
    expect(fin.rows[0].statut).toBe("soldee");
    expect(Number(fin.rows[0].solde)).toBe(0);
  });

  it("calcule la caisse : encaissements + remboursements - dépenses - avoirs, puis signale l'écart", async () => {
    await en(db, U.vendeurA, () =>
      db.query(
        "insert into depenses (organisation_id, boutique_id, categorie, montant, auteur_id) values ($1, $2, 'transport', 1500, $3)",
        [f.orgA, f.boutiqueA, U.vendeurA],
      ),
    );
    const jour = new Date().toISOString().slice(0, 10);
    const c = (
      await lignes<{ r: Record<string, number> }>(
        db,
        U.vendeurA,
        "select calculer_caisse($1, $2::date) as r",
        [f.boutiqueA, jour],
      )
    )[0].r;
    expect(c.especes_attendues).toBe(
      c.encaissements_especes +
        c.remboursements_credit_especes -
        c.depenses_especes -
        c.avoirs_especes,
    );
    expect(c.depenses_especes).toBe(1500);
    expect(c.avoirs_especes).toBe(11000);
    expect(c.mtn_momo).toBeGreaterThan(0);

    const cl = (
      await lignes<{ r: Record<string, number> }>(
        db,
        U.vendeurA,
        "select cloturer_caisse($1, $2::date, $3) as r",
        [f.boutiqueA, jour, c.especes_attendues - 2000],
      )
    )[0].r;
    expect(cl.ecart).toBe(-2000);
    const alerte = await db.query(
      "select 1 from journal_activite where action = 'caisse_cloturee' and alerte",
    );
    expect(alerte.rows.length).toBe(1);
    await expect(
      lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
        f.boutiqueA,
        jour,
      ]),
    ).rejects.toThrow(/déjà clôturée/);
    await expect(
      lignes(db, U.vendeurA, "select valider_cloture($1)", [cl.cloture_id]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await lignes(db, U.patronA, "select valider_cloture($1)", [cl.cloture_id]);
  });

  it("gère les mouvements de stock : perte avec motif, inventaire, droits", async () => {
    await expect(
      lignes(
        db,
        U.vendeurA,
        "select enregistrer_mouvement_stock($1, $2, 'entree', 1)",
        [f.boutiqueA, f.clous.id],
      ),
    ).rejects.toThrow(/Seul le propriétaire/);
    await expect(
      lignes(
        db,
        U.patronA,
        "select enregistrer_mouvement_stock($1, $2, 'perte', 1)",
        [f.boutiqueA, f.clous.id],
      ),
    ).rejects.toThrow(/motif/);
    await lignes(
      db,
      U.patronA,
      "select enregistrer_mouvement_stock($1, $2, 'entree', 10)",
      [f.boutiqueA, f.clous.id],
    );
    await lignes(
      db,
      U.patronA,
      "select enregistrer_mouvement_stock($1, $2, 'inventaire', 7)",
      [f.boutiqueA, f.clous.id],
    );
    expect(await stock(f.clous.id)).toBe(7);
  });
});
