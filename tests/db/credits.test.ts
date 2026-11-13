import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { cle, creerBase, lignes, preparer, U } from "./helpers";

let db: PGlite;
let f: Awaited<ReturnType<typeof preparer>>;
let marie: string;
let paul: string;

type Pmt = {
  numero_recu: string;
  montant: number;
  mode: string;
  repartition: {
    numero_recu_vente: string;
    montant: number;
    solde_apres: number;
  }[];
  dette_restante: number;
  deja_enregistre: boolean;
};
const payer = (
  user: string,
  client: string,
  montant: number,
  mode = "especes",
  k = cle(),
  boutique = f.boutiqueA,
) =>
  lignes<{ r: Pmt }>(
    db,
    user,
    "select rembourser_client($1, $2, $3, $4, $5) as r",
    [boutique, client, montant, mode, k],
  ).then((r) => r[0].r);
const dettes = (user: string, tri = "montant", decalage = 0) =>
  lignes<{
    r: {
      clients: {
        client_id: string;
        nom: string;
        dette: number;
        nb_ventes: number;
      }[];
      total_dettes: number;
      total_clients: number;
    };
  }>(db, user, "select lister_dettes($1, $2, 30, $3) as r", [
    f.boutiqueA,
    tri,
    decalage,
  ]).then((r) => r[0].r);
const solde = async (c: string) =>
  Number(
    (
      await db.query<{ s: string }>(
        "select coalesce(sum(solde), 0) s from creances where client_id = $1 and statut = 'ouverte'",
        [c],
      )
    ).rows[0].s,
  );

async function vendreACredit(
  client: string,
  produit: { id: string; unites: Record<string, string> },
  unite: string,
  q: number,
  acompte = 0,
) {
  await lignes(
    db,
    U.vendeurA,
    "select creer_vente($1, $2, $3::jsonb, $4::jsonb, $5)",
    [
      f.boutiqueA,
      cle(),
      JSON.stringify([
        {
          produit_id: produit.id,
          unite_id: produit.unites[unite],
          quantite: q,
        },
      ]),
      JSON.stringify(acompte ? [{ mode: "especes", montant: acompte }] : []),
      client,
    ],
  );
}

beforeAll(async () => {
  db = await creerBase();
  f = await preparer(db);
  await db.query(
    "update clients set plafond_credit = 1000000, telephone = '+237699111111' where id = $1",
    [f.client],
  );
  marie = (
    await db.query<{ id: string }>(
      "insert into clients (organisation_id, nom, telephone, plafond_credit) values ($1, 'Marie Fotso', '+237677222222', 1000000) returning id",
      [f.orgA],
    )
  ).rows[0].id;
  paul = (
    await db.query<{ id: string }>(
      "insert into clients (organisation_id, nom, plafond_credit) values ($1, 'Paul Éssomba', 1000000) returning id",
      [f.orgA],
    )
  ).rows[0].id;
  await db.query(
    "update stock_courant set quantite = 100000 where boutique_id = $1",
    [f.boutiqueA],
  );
  // Jean : 3 dettes (5 500 + 1 200 + 2 400 = 9 100). Marie : 1 dette de 11 000. Paul : aucune.
  await vendreACredit(f.client, f.ciment, "sac", 1);
  await vendreACredit(f.client, f.clous, "kg", 1);
  await vendreACredit(f.client, f.clous, "kg", 2);
  await vendreACredit(marie, f.ciment, "sac", 2);
  // Datation distincte pour tester l'ancienneté : Marie a la plus vieille dette.
  await db.query("set session_replication_role = replica");
  await db.query(
    "update creances set cree_le = now() - interval '40 days' where client_id = $1",
    [marie],
  );
  for (const [montant, jours] of [
    [5500, 10],
    [1200, 8],
    [2400, 5],
  ]) {
    await db.query(
      "update creances set cree_le = now() - make_interval(days => $2) where client_id = $1 and montant_du = $3",
      [f.client, jours, montant],
    );
  }
  await db.query("set session_replication_role = origin");
});

describe("lister_dettes (qui me doit de l'argent)", () => {
  it("donne un client par ligne, avec le total des dettes", async () => {
    const r = await dettes(U.vendeurA);
    expect(r.total_dettes).toBe(20100);
    expect(r.total_clients).toBe(2);
    expect(
      r.clients.map((c) => [c.nom, Number(c.dette), Number(c.nb_ventes)]),
    ).toEqual([
      ["Marie Fotso", 11000, 1],
      ["Jean Mbarga", 9100, 3],
    ]);
  });
  it("trie par ancienneté : la plus vieille dette d'abord", async () => {
    expect(
      (await dettes(U.vendeurA, "anciennete")).clients.map((c) => c.nom),
    ).toEqual(["Marie Fotso", "Jean Mbarga"]);
    await db.query("set session_replication_role = replica");
    await db.query(
      "update creances set cree_le = now() - interval '90 days' where client_id = $1 and montant_du = 5500",
      [f.client],
    );
    await db.query("set session_replication_role = origin");
    expect(
      (await dettes(U.vendeurA, "anciennete")).clients.map((c) => c.nom),
    ).toEqual(["Jean Mbarga", "Marie Fotso"]);
  });
  it("pagine, refuse un tri inconnu et une boutique non autorisée", async () => {
    expect((await dettes(U.vendeurA, "montant", 1)).clients).toHaveLength(1);
    await expect(dettes(U.vendeurA, "hasard")).rejects.toThrow(/Tri invalide/);
    await expect(
      lignes(db, U.vendeurA, "select lister_dettes($1)", [f.boutiqueA2]),
    ).rejects.toThrow(/Accès refusé/);
    await expect(
      lignes(db, U.patronB, "select lister_dettes($1)", [f.boutiqueA]),
    ).rejects.toThrow(/Accès refusé/);
  });
  it("ignore les crédits annulés et les soldés", async () => {
    const [v] = (
      await db.query<{ vente_id: string }>(
        "select vente_id from creances where client_id = $1 limit 1",
        [marie],
      )
    ).rows;
    await lignes(db, U.patronA, "select annuler_vente($1, 'Test')", [
      v.vente_id,
    ]);
    expect((await dettes(U.vendeurA)).clients.map((c) => c.nom)).toEqual([
      "Jean Mbarga",
    ]);
  });
});

describe("lister_clients", () => {
  const lister = (user: string, o: Record<string, unknown> = {}) =>
    lignes<{
      r: {
        clients: { id: string; nom: string; dette: number }[];
        suivant: { nom: string; id: string } | null;
      };
    }>(db, user, "select lister_clients($1, $2, $3, $4, $5) as r", [
      f.boutiqueA,
      o.q ?? null,
      o.limite ?? 30,
      o.apresNom ?? null,
      o.apresId ?? null,
    ]).then((r) => r[0].r);
  it("liste par ordre alphabétique sans accents, avec la dette de chacun", async () => {
    const r = await lister(U.vendeurA);
    expect(r.clients.map((c) => [c.nom, Number(c.dette)])).toEqual([
      ["Jean Mbarga", 9100],
      ["Marie Fotso", 0],
      ["Paul Éssomba", 0],
    ]);
  });
  it("cherche par nom (sans accents ni casse) ou par téléphone", async () => {
    expect(
      (await lister(U.vendeurA, { q: "essomba" })).clients.map((c) => c.nom),
    ).toEqual(["Paul Éssomba"]);
    expect(
      (await lister(U.vendeurA, { q: "677 22 22 22" })).clients.map(
        (c) => c.nom,
      ),
    ).toEqual(["Marie Fotso"]);
    expect((await lister(U.vendeurA, { q: "%" })).clients).toHaveLength(0);
  });
  it("pagine par curseur sans doublon", async () => {
    const vus: string[] = [];
    let page = await lister(U.vendeurA, { limite: 1 });
    for (;;) {
      vus.push(...page.clients.map((c) => c.nom));
      if (!page.suivant) break;
      page = await lister(U.vendeurA, {
        limite: 1,
        apresNom: page.suivant.nom,
        apresId: page.suivant.id,
      });
    }
    expect(vus).toEqual(["Jean Mbarga", "Marie Fotso", "Paul Éssomba"]);
  });
  it("n'expose rien d'une autre organisation", async () => {
    await expect(
      lignes(db, U.patronB, "select lister_clients($1)", [f.boutiqueA]),
    ).rejects.toThrow(/Accès refusé/);
    expect(
      (
        await lignes<{ r: { clients: unknown[] } }>(
          db,
          U.patronB,
          "select lister_clients($1) as r",
          [f.boutiqueB],
        )
      )[0].r.clients,
    ).toHaveLength(0);
  });
});

describe("rembourser_client", () => {
  it("rembourse les plus anciennes dettes d'abord, avec un seul reçu de paiement", async () => {
    // Jean doit 9 100 : 5 500 (vieille), 1 200, 2 400. Un paiement de 6 000 solde la plus ancienne et entame la suivante.
    const r = await payer(U.vendeurA, f.client, 6000);
    expect(r.numero_recu).toMatch(/^P-\d{4}-000001$/);
    expect(r.montant).toBe(6000);
    expect(
      r.repartition.map((x) => [Number(x.montant), Number(x.solde_apres)]),
    ).toEqual([
      [5500, 0],
      [500, 700],
    ]);
    expect(r.dette_restante).toBe(3100);
    expect(await solde(f.client)).toBe(3100);
    const lignesPaiement = await db.query(
      "select 1 from paiements where numero_recu = $1",
      [r.numero_recu],
    );
    expect(lignesPaiement.rows).toHaveLength(2);
  });
  it("est idempotente : la même clé ne crédite jamais deux fois", async () => {
    const k = cle();
    const a = await payer(U.vendeurA, f.client, 1000, "mtn_momo", k);
    const avant = await solde(f.client);
    const b = await payer(U.vendeurA, f.client, 1000, "mtn_momo", k);
    expect(b.deja_enregistre).toBe(true);
    expect(b.numero_recu).toBe(a.numero_recu);
    expect(await solde(f.client)).toBe(avant);
  });
  it("une clé réutilisée par erreur pour un autre client ne touche pas le premier (la clé identifie l'opération)", async () => {
    const k = cle();
    await payer(U.vendeurA, f.client, 100, "especes", k);
    const doublon = await payer(U.vendeurA, marie, 100, "especes", k).catch(
      (e: Error) => e,
    );
    // Marie n'a plus de dette (vente annulée) : aucune écriture n'a lieu pour elle.
    expect(
      doublon instanceof Error || (doublon as Pmt).deja_enregistre === true,
    ).toBe(true);
    expect(await solde(marie)).toBe(0);
  });
  it("accepte un paiement total et solde tout", async () => {
    const reste = await solde(f.client);
    const r = await payer(U.patronA, f.client, reste, "orange_money");
    expect(r.dette_restante).toBe(0);
    expect(
      (
        await db.query(
          "select 1 from creances where client_id = $1 and statut = 'ouverte'",
          [f.client],
        )
      ).rows,
    ).toHaveLength(0);
    expect((await dettes(U.vendeurA)).total_clients).toBe(0);
  });
  it("refuse un montant nul, trop grand, un client qui ne doit rien, un mode inconnu", async () => {
    await vendreACredit(f.client, f.clous, "kg", 1);
    await expect(payer(U.vendeurA, f.client, 0)).rejects.toThrow(
      /supérieur à zéro/,
    );
    await expect(payer(U.vendeurA, f.client, 999999)).rejects.toThrow(
      /dépasse ce que le client doit \(1200 FCFA\)/,
    );
    await expect(payer(U.vendeurA, paul, 100)).rejects.toThrow(/ne doit rien/);
    await expect(payer(U.vendeurA, f.client, 100, "cheque")).rejects.toThrow(
      /Mode de paiement/,
    );
  });
  it("ne se perd pas à moitié : un échec n'écrit rien (même pas le numéro de reçu)", async () => {
    const compteur = async () =>
      Number(
        (
          await db.query<{ dernier: number }>(
            "select dernier from compteurs_recus where type = 'paiement'",
          )
        ).rows[0].dernier,
      );
    const avant = await compteur();
    const lignesAvant = Number(
      (await db.query<{ n: string }>("select count(*) n from paiements"))
        .rows[0].n,
    );
    await expect(payer(U.vendeurA, f.client, 999999)).rejects.toThrow();
    expect(await compteur()).toBe(avant);
    expect(
      Number(
        (await db.query<{ n: string }>("select count(*) n from paiements"))
          .rows[0].n,
      ),
    ).toBe(lignesAvant);
  });
  it("compte les espèces dans la caisse du jour, pas le Mobile Money", async () => {
    const jour = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Douala",
    }).format(new Date());
    const avant = (
      await lignes<{
        r: { remboursements_credit_especes: number; mtn_momo: number };
      }>(db, U.vendeurA, "select calculer_caisse($1, $2::date) as r", [
        f.boutiqueA,
        jour,
      ])
    )[0].r;
    await payer(U.vendeurA, f.client, 200, "especes");
    await payer(U.vendeurA, f.client, 300, "mtn_momo");
    const apres = (
      await lignes<{
        r: { remboursements_credit_especes: number; mtn_momo: number };
      }>(db, U.vendeurA, "select calculer_caisse($1, $2::date) as r", [
        f.boutiqueA,
        jour,
      ])
    )[0].r;
    expect(
      apres.remboursements_credit_especes - avant.remboursements_credit_especes,
    ).toBe(200);
    expect(apres.mtn_momo - avant.mtn_momo).toBe(300);
  });
  it("est isolée : autre organisation, boutique non autorisée, client d'une autre organisation", async () => {
    await expect(
      payer(U.patronB, f.client, 100, "especes", cle(), f.boutiqueB),
    ).rejects.toThrow(/Client introuvable/);
    await expect(payer(U.patronB, f.client, 100)).rejects.toThrow(
      /Boutique introuvable/,
    );
    await expect(
      payer(U.vendeurA, f.client, 100, "especes", cle(), f.boutiqueA2),
    ).rejects.toThrow(/Accès refusé/);
  });
  it("est bloquée quand l'abonnement est suspendu", async () => {
    await db.query(
      "update abonnements set statut = 'suspendu' where organisation_id = $1",
      [f.orgA],
    );
    await expect(payer(U.vendeurA, f.client, 100)).rejects.toThrow(
      /lecture seule/,
    );
    await db.query(
      "update abonnements set statut = 'actif' where organisation_id = $1",
      [f.orgA],
    );
  });
  it("est journalisée", async () => {
    expect(
      Number(
        (
          await db.query<{ n: string }>(
            "select count(*) n from journal_activite where action = 'remboursement_credit'",
          )
        ).rows[0].n,
      ),
    ).toBeGreaterThan(3);
  });
});

describe("archivage d'un client", () => {
  it("refuse tant que le client doit de l'argent, accepte après paiement", async () => {
    await expect(
      lignes(
        db,
        U.patronA,
        "update clients set archive_le = now() where id = $1",
        [f.client],
      ),
    ).rejects.toThrow(/doit encore .* FCFA/);
    await payer(U.patronA, f.client, await solde(f.client));
    await lignes(
      db,
      U.patronA,
      "update clients set archive_le = now() where id = $1",
      [f.client],
    );
    expect(
      (await lignes(db, U.vendeurA, "select lister_clients($1)", [f.boutiqueA]))
        .length,
    ).toBe(1);
  });
  it("un vendeur ne peut ni modifier ni archiver un client", async () => {
    expect(
      await lignes(
        db,
        U.vendeurA,
        "update clients set archive_le = now() where id = $1 returning id",
        [paul],
      ),
    ).toHaveLength(0);
    expect(
      await lignes(
        db,
        U.vendeurA,
        "update clients set plafond_credit = 99999999 where id = $1 returning id",
        [paul],
      ),
    ).toHaveLength(0);
  });
});

describe("l'aperçu de répartition (TypeScript) donne exactement ce que fait la base", () => {
  it("sur un client qui doit plusieurs ventes de dates différentes", async () => {
    const { repartirFifo } = await import("@/lib/clients/credit");
    for (const q of [1, 2, 3]) await vendreACredit(paul, f.clous, "kg", q);
    await db.query("set session_replication_role = replica");
    for (const [q, jours] of [
      [3600, 3],
      [1200, 9],
      [2400, 6],
    ])
      await db.query(
        "update creances set cree_le = now() - make_interval(days => $2) where client_id = $1 and montant_du = $3",
        [paul, jours, q],
      );
    await db.query("set session_replication_role = origin");
    const ouvertes = (
      await db.query<{
        id: string;
        numero_recu: string;
        date: string;
        solde: string;
      }>(
        "select cr.id, v.numero_recu, cr.cree_le as date, cr.solde from creances cr join ventes v on v.id = cr.vente_id where cr.client_id = $1 and cr.statut = 'ouverte'",
        [paul],
      )
    ).rows.map((r) => ({
      id: r.id,
      numeroRecu: r.numero_recu,
      date: new Date(r.date).toISOString(),
      solde: Number(r.solde),
    }));
    const apercu = repartirFifo(ouvertes, 5000);
    const reel = await payer(U.vendeurA, paul, 5000);
    expect(apercu.ok).toBe(true);
    if (!apercu.ok) return;
    expect(
      reel.repartition.map((x) => [
        x.numero_recu_vente,
        Number(x.montant),
        Number(x.solde_apres),
      ]),
    ).toEqual(apercu.parts.map((p) => [p.numeroRecu, p.montant, p.soldeApres]));
    expect(reel.dette_restante).toBe(apercu.detteApres);
  });
});
