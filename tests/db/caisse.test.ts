import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { especesAttendues } from "../../lib/caisse/caisse";
import { cle, creerBase, en, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;

const jour = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(
    new Date(),
  );
const demain = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(
    new Date(Date.now() + 86_400_000),
  );

const depenser = (
  user: string,
  o: {
    categorie?: string;
    montant?: number | null;
    mode?: string;
    note?: string | null;
    cle?: string | null;
    boutique?: string;
  } = {},
) =>
  lignes<{ r: { id: string; deja_enregistree: boolean } }>(
    db,
    user,
    "select enregistrer_depense($1, $2, $3, $4, $5, $6) as r",
    [
      o.boutique ?? f.boutiqueA,
      o.categorie ?? "transport",
      o.montant === undefined ? 1000 : o.montant,
      o.mode ?? "especes",
      o.note ?? null,
      o.cle === undefined ? cle() : o.cle,
    ],
  ).then((x) => x[0].r);

const caisse = (user: string, boutique = f.boutiqueA, date = jour()) =>
  lignes<{ r: Record<string, number> }>(
    db,
    user,
    "select calculer_caisse($1, $2::date) as r",
    [boutique, date],
  ).then((x) => x[0].r);

const vendre = (
  user: string,
  paiements: unknown[],
  q = 1,
  client: string | null = null,
) =>
  lignes<{ r: { vente_id: string; total: number } }>(
    db,
    user,
    "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5) as r",
    [
      f.boutiqueA,
      cle(),
      JSON.stringify([
        { produit_id: f.ciment.id, unite_id: f.ciment.unites.kg, quantite: q },
      ]),
      JSON.stringify(paiements),
      client,
    ],
  ).then((x) => x[0].r);

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
});

describe("enregistrer_depense", () => {
  it("enregistre une dépense, la journalise et la compte dans la caisse", async () => {
    const avant = await caisse(U.vendeurA);
    const r = await depenser(U.vendeurA, {
      montant: 2500,
      note: "  Taxi  ",
    });
    expect(r.deja_enregistree).toBe(false);
    const apres = await caisse(U.vendeurA);
    expect(apres.depenses_especes - avant.depenses_especes).toBe(2500);
    expect(apres.especes_attendues - avant.especes_attendues).toBe(-2500);
    const d = await db.query<{ note: string; auteur_id: string }>(
      "select note, auteur_id from depenses where id = $1",
      [r.id],
    );
    expect(d.rows[0]).toEqual({ note: "Taxi", auteur_id: U.vendeurA });
    const j = await db.query(
      "select 1 from journal_activite where action = 'depense_enregistree' and entite_id = $1",
      [r.id],
    );
    expect(j.rows).toHaveLength(1);
  });

  it("une dépense payée en Mobile Money ne sort pas du tiroir", async () => {
    const avant = await caisse(U.vendeurA);
    await depenser(U.vendeurA, { montant: 4000, mode: "mtn_momo" });
    const apres = await caisse(U.vendeurA);
    expect(apres.depenses_total - avant.depenses_total).toBe(4000);
    expect(apres.depenses_especes).toBe(avant.depenses_especes);
    expect(apres.especes_attendues).toBe(avant.especes_attendues);
  });

  it("jamais deux fois : la même clé ne crée qu'une dépense", async () => {
    const k = cle();
    const a = await depenser(U.vendeurA, { montant: 700, cle: k });
    const b = await depenser(U.vendeurA, { montant: 700, cle: k });
    expect(b.deja_enregistree).toBe(true);
    expect(b.id).toBe(a.id);
    const n = await db.query(
      "select count(*)::int n from depenses where cle_idempotence = $1",
      [k],
    );
    expect(n.rows[0]).toEqual({ n: 1 });
  });

  it("refuse les saisies invalides avec un message en français", async () => {
    await expect(depenser(U.vendeurA, { montant: 0 })).rejects.toThrow(
      /supérieur à zéro/,
    );
    await expect(depenser(U.vendeurA, { montant: -5 })).rejects.toThrow(
      /supérieur à zéro/,
    );
    await expect(depenser(U.vendeurA, { montant: null })).rejects.toThrow(
      /supérieur à zéro/,
    );
    await expect(
      depenser(U.vendeurA, { montant: 100_000_001 }),
    ).rejects.toThrow(/trop élevé/);
    await expect(
      depenser(U.vendeurA, { categorie: "loisirs" }),
    ).rejects.toThrow(/catégorie/);
    await expect(depenser(U.vendeurA, { mode: "cheque" })).rejects.toThrow(
      /mode de paiement/,
    );
    await expect(
      depenser(U.vendeurA, { note: "x".repeat(201) }),
    ).rejects.toThrow(/trop longue/);
    await expect(depenser(U.vendeurA, { cle: null })).rejects.toThrow(/Clé/);
  });

  it("le salaire est réservé au propriétaire", async () => {
    await expect(
      depenser(U.vendeurA, { categorie: "salaire", montant: 50_000 }),
    ).rejects.toThrow(/Seul le propriétaire/);
    const r = await depenser(U.patronA, {
      categorie: "salaire",
      montant: 50_000,
    });
    expect(r.deja_enregistree).toBe(false);
  });

  it("refuse une autre organisation, une boutique non autorisée et un visiteur", async () => {
    await expect(depenser(U.patronB)).rejects.toThrow(/Boutique introuvable/);
    await expect(
      depenser(U.vendeurA, { boutique: f.boutiqueA2 }),
    ).rejects.toThrow(/Accès refusé/);
    await expect(depenser(null as unknown as string)).rejects.toThrow();
  });

  it("n'accepte plus l'écriture directe dans depenses", async () => {
    await expect(
      en(db, U.patronA, () =>
        db.query(
          "insert into depenses (organisation_id, boutique_id, categorie, montant, auteur_id) values ($1, $2, 'autre', 10, $3)",
          [f.orgA, f.boutiqueA, U.patronA],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("une dépense ne se modifie ni ne se supprime", async () => {
    const r = await depenser(U.patronA, { montant: 123 });
    await expect(
      db.query("update depenses set montant = 1 where id = $1", [r.id]),
    ).rejects.toThrow(/modifi/i);
    await expect(
      db.query("delete from depenses where id = $1", [r.id]),
    ).rejects.toThrow();
  });

  it("un compte suspendu est en lecture seule", async () => {
    await db.query(
      "insert into abonnements (organisation_id, plan_code, statut) values ($1, 'business', 'suspendu') on conflict (organisation_id) do update set statut = 'suspendu'",
      [f.orgA],
    );
    try {
      await expect(depenser(U.vendeurA)).rejects.toThrow(/lecture seule/);
      await expect(
        lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
          f.boutiqueA,
          jour(),
        ]),
      ).rejects.toThrow(/lecture seule/);
    } finally {
      await db.query(
        "update abonnements set statut = 'actif' where organisation_id = $1",
        [f.orgA],
      );
    }
  });

  it("la RLS : un vendeur ne voit pas les dépenses d'une boutique non autorisée, une autre organisation ne voit rien", async () => {
    await depenser(U.patronA, { boutique: f.boutiqueA2, montant: 999 });
    const vendeur = await lignes(
      db,
      U.vendeurA,
      "select id from depenses where boutique_id = $1",
      [f.boutiqueA2],
    );
    expect(vendeur).toHaveLength(0);
    const autre = await lignes(db, U.patronB, "select id from depenses");
    expect(autre).toHaveLength(0);
  });
});

describe("annuler_depense", () => {
  const annuler = (
    user: string,
    id: string,
    motif: string,
    boutique = f.boutiqueA,
  ) =>
    lignes(db, user, "select annuler_depense($1, $2, $3)", [
      boutique,
      id,
      motif,
    ]);

  it("est réservée au propriétaire, avec un motif ; la dépense annulée ne sort plus de la caisse mais reste visible", async () => {
    const avant = (await caisse(U.patronA)).depenses_especes;
    const d = await depenser(U.vendeurA, { montant: 5000 }); // « 50 000 » tapé par erreur, par exemple
    expect((await caisse(U.patronA)).depenses_especes).toBe(avant + 5000);
    await expect(annuler(U.vendeurA, d.id, "oups")).rejects.toThrow(
      /Seul le propriétaire/,
    );
    await expect(annuler(U.patronA, d.id, "  ")).rejects.toThrow(/motif/);
    await expect(annuler(U.patronA, d.id, "x".repeat(201))).rejects.toThrow(
      /trop long/,
    );
    await annuler(U.patronA, d.id, "Erreur de saisie");
    expect((await caisse(U.patronA)).depenses_especes).toBe(avant);
    const ligne = await db.query<{
      annulee_le: string | null;
      motif_annulation: string;
    }>("select annulee_le, motif_annulation from depenses where id = $1", [
      d.id,
    ]);
    expect(ligne.rows[0].annulee_le).not.toBeNull(); // elle reste en base, barrée à l'écran
    expect(ligne.rows[0].motif_annulation).toBe("Erreur de saisie");
    await expect(annuler(U.patronA, d.id, "encore")).rejects.toThrow(
      /déjà annulée/,
    );
  });

  it("une dépense ne se modifie jamais, sauf pour être annulée avec un motif ; elle ne se supprime pas", async () => {
    const d = await depenser(U.vendeurA, { montant: 100 });
    await expect(
      db.query("update depenses set montant = 1 where id = $1", [d.id]),
    ).rejects.toThrow(/ne peut pas être modifiée/);
    await expect(
      db.query("update depenses set annulee_le = now() where id = $1", [d.id]),
    ).rejects.toThrow(/ne peut pas être modifiée/); // annulation sans motif
    await expect(
      db.query("delete from depenses where id = $1", [d.id]),
    ).rejects.toThrow(/Suppression interdite/);
    await annuler(U.patronA, d.id, "Nettoyage");
    await expect(
      db.query("update depenses set motif_annulation = 'autre' where id = $1", [
        d.id,
      ]),
    ).rejects.toThrow(/ne peut pas être modifiée/); // le motif ne se réécrit pas
  });

  it("refuse une dépense inconnue ou d'une autre organisation", async () => {
    await expect(annuler(U.patronA, cle(), "x")).rejects.toThrow(/introuvable/);
    await expect(annuler(U.patronB, cle(), "x")).rejects.toThrow(
      /Boutique introuvable/,
    );
  });

  it("est signalée dans le journal (alerte)", async () => {
    const d = await depenser(U.vendeurA, { montant: 250 });
    await annuler(U.patronA, d.id, "Doublon");
    const j = await db.query(
      "select 1 from journal_activite where action = 'depense_annulee' and entite_id = $1 and alerte and details->>'motif' = 'Doublon'",
      [d.id],
    );
    expect(j.rows).toHaveLength(1);
  });
});

describe("calculer_caisse", () => {
  it("cohérence : le total de la base égale la formule TypeScript, y compris crédit, MoMo et annulation", async () => {
    await vendre(U.vendeurA, [{ mode: "especes" }], 2);
    await vendre(U.vendeurA, [{ mode: "mtn_momo" }], 3);
    await vendre(U.vendeurA, [{ mode: "especes", montant: 500 }], 4, f.client);
    const c = await caisse(U.patronA);
    expect(c.credit_accorde).toBeGreaterThan(0);
    expect(c.nb_ventes).toBeGreaterThanOrEqual(3);
    expect(c.mtn_momo).toBeGreaterThan(0);
    expect(c.especes_attendues).toBe(
      especesAttendues({
        encaissementsEspeces: c.encaissements_especes,
        remboursementsCreditEspeces: c.remboursements_credit_especes,
        depensesEspeces: c.depenses_especes,
        avoirsEspeces: c.avoirs_especes,
      }),
    );
  });

  it("une vente annulée sort du total, rembourse les espèces et le Mobile Money apparaît en remboursé", async () => {
    const avant = await caisse(U.patronA);
    const v = await vendre(U.vendeurA, [{ mode: "mtn_momo" }], 5);
    const e = await vendre(U.vendeurA, [{ mode: "especes" }], 1);
    const milieu = await caisse(U.patronA);
    expect(milieu.ventes_total - avant.ventes_total).toBe(v.total + e.total);
    await lignes(
      db,
      U.patronA,
      "select annuler_vente($1, 'Erreur de saisie')",
      [v.vente_id],
    );
    await lignes(db, U.patronA, "select annuler_vente($1, 'Client parti')", [
      e.vente_id,
    ]);
    const apres = await caisse(U.patronA);
    expect(apres.ventes_total).toBe(avant.ventes_total);
    expect(apres.mtn_momo_rembourse - avant.mtn_momo_rembourse).toBe(v.total);
    expect(apres.avoirs_especes - avant.avoirs_especes).toBe(e.total);
    // Les espèces attendues reviennent exactement à leur valeur d'avant les deux ventes.
    expect(apres.especes_attendues).toBe(avant.especes_attendues);
  });

  it("un autre jour est vide, et une autre organisation n'y accède pas", async () => {
    const c = await caisse(U.patronA, f.boutiqueA, "2000-01-01");
    expect(c.ventes_total).toBe(0);
    expect(c.especes_attendues).toBe(0);
    await expect(caisse(U.patronB, f.boutiqueA)).rejects.toThrow(
      /Boutique introuvable/,
    );
  });
});

describe("cloturer_caisse et valider_cloture", () => {
  it("refuse une date future", async () => {
    await expect(
      lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
        f.boutiqueA,
        demain(),
      ]),
    ).rejects.toThrow(/pas encore eu lieu/);
  });

  it("refuse un montant négatif ou absent", async () => {
    await expect(
      lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, -1)", [
        f.boutiqueA,
        jour(),
      ]),
    ).rejects.toThrow(/invalide/);
    await expect(
      lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, null)", [
        f.boutiqueA,
        jour(),
      ]),
    ).rejects.toThrow(/invalide/);
  });

  it("clôture avec écart dans la tolérance : pas d'alerte ; au-delà : alerte ; une seule clôture par jour", async () => {
    const hier = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
    }).format(new Date(Date.now() - 86_400_000));
    // Un jour passé sans mouvement : attendu 0. Tolérance par défaut : 500 FCFA.
    const ok = (
      await lignes<{ r: { ecart: number; cloture_id: string } }>(
        db,
        U.vendeurA,
        "select cloturer_caisse($1, $2::date, 500) as r",
        [f.boutiqueA, hier],
      )
    )[0].r;
    expect(ok.ecart).toBe(500);
    const alertes = await db.query(
      "select 1 from journal_activite where action = 'caisse_cloturee' and entite_id = $1 and alerte",
      [ok.cloture_id],
    );
    expect(alertes.rows).toHaveLength(0);

    const c = await caisse(U.patronA);
    // Les dépenses du jour peuvent dépasser les espèces encaissées : l'attendu est alors négatif.
    const compte = Math.max(0, c.especes_attendues) + 501;
    const r = (
      await lignes<{ r: { ecart: number; especes_attendues: number } }>(
        db,
        U.vendeurA,
        "select cloturer_caisse($1, $2::date, $3) as r",
        [f.boutiqueA, jour(), compte],
      )
    )[0].r;
    expect(r.ecart).toBe(compte - c.especes_attendues);
    expect(r.ecart).toBeGreaterThan(500);
    expect(r.especes_attendues).toBe(c.especes_attendues);
    const alerte = await db.query(
      "select 1 from journal_activite where action = 'caisse_cloturee' and alerte and (details->>'ecart')::bigint = $1",
      [r.ecart],
    );
    expect(alerte.rows).toHaveLength(1);
    await expect(
      lignes(db, U.patronA, "select cloturer_caisse($1, $2::date, 0)", [
        f.boutiqueA,
        jour(),
      ]),
    ).rejects.toThrow(/déjà clôturée/);
  });

  it("la clôture est immuable et seule la validation du propriétaire la complète, une seule fois", async () => {
    const cl = await db.query<{ id: string; especes_comptees: string }>(
      "select id, especes_comptees from clotures_caisse where boutique_id = $1 and date = $2",
      [f.boutiqueA, jour()],
    );
    const id = cl.rows[0].id;
    await expect(
      lignes(db, U.vendeurA, "select valider_cloture($1)", [id]),
    ).rejects.toThrow(/Seul le propriétaire/);
    await expect(
      lignes(db, U.patronB, "select valider_cloture($1)", [id]),
    ).rejects.toThrow(/Boutique introuvable/);
    await lignes(db, U.patronA, "select valider_cloture($1)", [id]);
    await expect(
      lignes(db, U.patronA, "select valider_cloture($1)", [id]),
    ).rejects.toThrow(/déjà validée/);
    await expect(
      en(db, U.patronA, () =>
        db.query("delete from clotures_caisse where id = $1", [id]),
      ),
    ).rejects.toThrow();
    const j = await db.query(
      "select 1 from journal_activite where action = 'caisse_validee' and entite_id = $1",
      [id],
    );
    expect(j.rows).toHaveLength(1);
  });

  it("refuse une date de plus de 30 jours, accepte exactement 30 jours", async () => {
    const ilYa = (n: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(
        new Date(Date.now() - n * 86_400_000),
      );
    await expect(
      lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
        f.boutiqueA,
        ilYa(31),
      ]),
    ).rejects.toThrow(/trop ancienne/);
    await lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
      f.boutiqueA,
      ilYa(30),
    ]);
  });

  it("une fois la journée clôturée : plus de nouvelle dépense, plus d'annulation de dépense ; une vente reste possible et ne change pas la clôture", async () => {
    await expect(depenser(U.vendeurA, { montant: 100 })).rejects.toThrow(
      /déjà clôturée/,
    );
    await expect(depenser(U.patronA, { montant: 100 })).rejects.toThrow(
      /déjà clôturée/,
    );
    const d = await db.query<{ id: string }>(
      "select id from depenses where boutique_id = $1 and annulee_le is null and (date at time zone 'Africa/Douala')::date = $2::date limit 1",
      [f.boutiqueA, jour()],
    );
    expect(d.rows.length).toBeGreaterThan(0);
    await expect(
      lignes(db, U.patronA, "select annuler_depense($1, $2, 'trop tard')", [
        f.boutiqueA,
        d.rows[0].id,
      ]),
    ).rejects.toThrow(/déjà clôturée/);

    const figee = await db.query<{ especes_attendues: string }>(
      "select especes_attendues from clotures_caisse where boutique_id = $1 and date = $2::date",
      [f.boutiqueA, jour()],
    );
    const avant = (await caisse(U.patronA)).especes_attendues;
    const v = await vendre(U.vendeurA, [{ mode: "especes" }], 1);
    expect((await caisse(U.patronA)).especes_attendues).toBe(avant + v.total);
    const apres = await db.query<{ especes_attendues: string }>(
      "select especes_attendues from clotures_caisse where boutique_id = $1 and date = $2::date",
      [f.boutiqueA, jour()],
    );
    expect(apres.rows[0].especes_attendues).toBe(
      figee.rows[0].especes_attendues,
    );
  });

  it("un vendeur ne clôture pas une boutique qui n'est pas la sienne", async () => {
    await expect(
      lignes(db, U.vendeurA, "select cloturer_caisse($1, $2::date, 0)", [
        f.boutiqueA2,
        jour(),
      ]),
    ).rejects.toThrow(/Accès refusé/);
  });
});
