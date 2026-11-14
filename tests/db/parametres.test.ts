import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBase, en, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;

const base = {
  nom: "Quincaillerie du Centre",
  adresse: "Marché Mokolo, Yaoundé",
  telephone: "+237699123456",
  mention: "Merci de votre confiance",
  seuil: 5,
  plafond: 100000,
  negatif: false,
  ecart: 500,
};

const modifier = (
  user: string | null,
  o: Partial<{
    boutique: string;
    nom: string | null;
    adresse: string | null;
    telephone: string | null;
    mention: string | null;
    seuil: number | null;
    plafond: number | null;
    negatif: boolean | null;
    ecart: number | null;
  }> = {},
) => {
  const v = { ...base, boutique: f.boutiqueA, ...o };
  return lignes<{ r: { modifie: boolean; champs?: string[] } }>(
    db,
    user,
    "select modifier_parametres_boutique($1, $2, $3, $4, $5, $6, $7, $8, $9) as r",
    [
      v.boutique,
      v.nom,
      v.adresse,
      v.telephone,
      v.mention,
      v.seuil,
      v.plafond,
      v.negatif,
      v.ecart,
    ],
  ).then((x) => x[0].r);
};

const journal = (action: string) =>
  db.query<{
    details: {
      champs: string[];
      avant: Record<string, unknown>;
      apres: Record<string, unknown>;
    };
  }>(
    "select details from journal_activite where action = $1 order by id desc",
    [action],
  );

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
});

describe("modifier_parametres_boutique", () => {
  it("enregistre, et journalise seulement ce qui a changé (avant/après pour les règles)", async () => {
    const r = await modifier(U.patronA, {
      seuil: 10,
      negatif: true,
      nom: "Quincaillerie Mokolo",
    });
    expect(r).toEqual({
      modifie: true,
      champs: expect.arrayContaining([
        "nom",
        "adresse",
        "telephone",
        "pied_de_recu",
        "seuil_remise_vendeur",
        "stock_negatif_autorise",
      ]),
    });
    const b = await db.query<{ nom: string; seuil: string; negatif: boolean }>(
      "select b.nom, p.seuil_remise_vendeur seuil, p.stock_negatif_autorise negatif from boutiques b join parametres_boutique p on p.boutique_id = b.id where b.id = $1",
      [f.boutiqueA],
    );
    expect(b.rows[0]).toMatchObject({
      nom: "Quincaillerie Mokolo",
      negatif: true,
    });
    expect(Number(b.rows[0].seuil)).toBe(10);
    const j = (await journal("parametres_modifies")).rows[0].details;
    expect(Number(j.apres.seuil_remise_vendeur)).toBe(10);
    expect(j.apres.stock_negatif_autorise).toBe(true);
    expect(j.avant.stock_negatif_autorise).toBe(false);
  });

  it("n'écrit rien quand rien ne change", async () => {
    const avant = (await journal("parametres_modifies")).rows.length;
    const r = await modifier(U.patronA, {
      nom: "Quincaillerie Mokolo",
      seuil: 10,
      negatif: true,
    });
    expect(r.modifie).toBe(false);
    expect((await journal("parametres_modifies")).rows.length).toBe(avant);
  });

  it("applique les nouveaux réglages aux fonctions de vente (stock négatif)", async () => {
    const vend = () =>
      lignes(
        db,
        U.vendeurA,
        "select creer_vente($1, gen_random_uuid(), $2::jsonb, $3::jsonb, null) as r",
        [
          f.boutiqueA,
          JSON.stringify([
            {
              produit_id: f.ciment.id,
              unite_id: f.ciment.unites.sac,
              quantite: 500,
            },
          ]),
          JSON.stringify([{ mode: "especes" }]),
        ],
      );
    await modifier(U.patronA, {
      nom: "Quincaillerie Mokolo",
      seuil: 10,
      negatif: false,
    });
    await expect(vend()).rejects.toThrow(/stock/i);
    await modifier(U.patronA, {
      nom: "Quincaillerie Mokolo",
      seuil: 10,
      negatif: true,
    });
    await expect(vend()).resolves.toBeDefined();
  });

  it("refuse un vendeur, une autre organisation, un visiteur et une boutique non autorisée", async () => {
    await expect(modifier(U.vendeurA)).rejects.toThrow(/Seul le propriétaire/);
    await expect(modifier(U.patronB)).rejects.toThrow(/Boutique introuvable/);
    await expect(modifier(null)).rejects.toThrow();
  });

  it("refuse les valeurs invalides avec un message en français", async () => {
    const cas: [Parameters<typeof modifier>[1], RegExp][] = [
      [{ nom: " a " }, /entre 2 et 80/],
      [{ nom: "x".repeat(81) }, /entre 2 et 80/],
      [{ nom: null }, /entre 2 et 80/],
      [{ adresse: "x".repeat(161) }, /adresse est trop longue/],
      [{ telephone: "abc" }, /téléphone est invalide/],
      [{ mention: "x".repeat(301) }, /pied de reçu est trop long/],
      [{ seuil: -1 }, /entre 0 et 100/],
      [{ seuil: 100.5 }, /entre 0 et 100/],
      [{ seuil: null }, /entre 0 et 100/],
      [{ seuil: 5.555 }, /deux décimales/],
      [{ plafond: -1 }, /plafond de crédit est invalide/],
      [{ plafond: 100000001 }, /plafond de crédit est invalide/],
      [{ negatif: null }, /stock négatif/],
      [{ ecart: -1 }, /écart de caisse/],
      [{ ecart: 10000001 }, /écart de caisse/],
    ];
    for (const [o, re] of cas)
      await expect(modifier(U.patronA, o), JSON.stringify(o)).rejects.toThrow(
        re,
      );
  });

  it("vide proprement les champs facultatifs", async () => {
    await modifier(U.patronA, {
      nom: "Quincaillerie Mokolo",
      seuil: 10,
      negatif: true,
      adresse: "  ",
      telephone: "",
      mention: null,
    });
    const b = await db.query<{
      adresse: string | null;
      telephone: string | null;
      mention_legale: string | null;
    }>(
      "select adresse, telephone, mention_legale from boutiques where id = $1",
      [f.boutiqueA],
    );
    expect(b.rows[0]).toEqual({
      adresse: null,
      telephone: null,
      mention_legale: null,
    });
  });

  it("un compte suspendu est en lecture seule", async () => {
    await db.query(
      "insert into abonnements (organisation_id, plan_code, statut) values ($1, 'business', 'suspendu') on conflict (organisation_id) do update set statut = 'suspendu'",
      [f.orgA],
    );
    try {
      await expect(modifier(U.patronA, { nom: "Autre nom" })).rejects.toThrow(
        /lecture seule/,
      );
    } finally {
      await db.query(
        "update abonnements set statut = 'actif' where organisation_id = $1",
        [f.orgA],
      );
    }
  });

  it("plus d'écriture directe sur boutiques ni parametres_boutique, même pour le propriétaire", async () => {
    await expect(
      en(db, U.patronA, () =>
        db.query(
          "update parametres_boutique set seuil_remise_vendeur = 99 where boutique_id = $1",
          [f.boutiqueA],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      en(db, U.patronA, () =>
        db.query("update boutiques set nom = 'Pirate' where id = $1", [
          f.boutiqueA,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
