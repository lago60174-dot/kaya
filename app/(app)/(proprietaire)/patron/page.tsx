import Link from "next/link";
import { Banknote, Boxes, ShoppingBag, Store, Users } from "lucide-react";
import { CourbeVentes } from "@/components/patron/courbe-ventes";
import { MiseAJourDirecte } from "@/components/patron/mise-a-jour-directe";
import { jourDouala } from "@/lib/caisse/caisse";
import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { decrire, libelleAction, lienEntite } from "@/lib/journal/journal";
import { peutUtiliser } from "@/lib/plans";
import { variationVsHier } from "@/lib/patron/direct";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireRapport } from "@/server/patron/rapports";
import {
  lireAlertesRecentes,
  lireTableauDeBord,
  listerBoutiques,
} from "@/server/patron/lecture";

export const metadata = { title: "Tableau de bord · Kaya" };

const carte =
  "kaya-kpi flex flex-col items-center gap-1 rounded-2xl border-0 p-4 text-center";

export default async function PagePatron({
  searchParams,
}: {
  searchParams: Promise<{ boutique?: string }>;
}) {
  const profil = await exigerRole("proprietaire");
  const supabase = await supabaseServeur();
  const boutiques = await listerBoutiques(supabase);
  // Le sélecteur n'existe que pour un plan qui permet plusieurs boutiques (Business) et seulement s'il y en a plusieurs.
  const multi =
    profil.plan !== null &&
    peutUtiliser(profil.plan, "multi_boutiques") &&
    boutiques.length > 1;
  const demandee = (await searchParams).boutique;
  const boutique =
    (multi ? boutiques.find((b) => b.id === demandee) : undefined) ??
    boutiques.find((b) => b.id === profil.boutiqueIds[0]) ??
    boutiques[0];
  if (!boutique)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;

  const complet = profil.plan
    ? peutUtiliser(profil.plan, "journal_complet")
    : false;
  const [t, alertes, rapport] = await Promise.all([
    lireTableauDeBord(supabase, boutique.id),
    lireAlertesRecentes(supabase, boutique.id, complet),
    lireRapport(supabase, boutique.id, 7),
  ]);
  if (!t)
    return (
      <p role="alert" className="text-danger">
        Impossible de charger le tableau de bord. Vérifiez votre connexion et
        rechargez la page.
      </p>
    );

  const variation = variationVsHier(t.ventesTotal, t.ventesHier);
  const maxVendu = Math.max(1, ...t.produitsVendus.map((p) => p.montant));

  return (
    <div className="kaya-dashboard flex max-w-3xl flex-col gap-6">
      <header className="kaya-dashboard-header flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <Store aria-hidden="true" size={30} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{boutique.nom}</h1>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-500" />
              En ligne
            </p>
            <p className="text-muted text-sm">
              Bonjour{profil.nom ? ` ${profil.nom}` : ""}
            </p>
          </div>
        </div>
        {multi && (
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="boutique" className="text-sm font-medium">
              Boutique
            </label>
            <select
              id="boutique"
              name="boutique"
              defaultValue={boutique.id}
              className="border-border min-h-11 rounded-lg border bg-white px-3"
            >
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nom}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border-border min-h-11 rounded-lg border px-4 text-sm font-medium"
            >
              Afficher
            </button>
          </form>
        )}
        <MiseAJourDirecte boutiqueId={boutique.id} />
      </header>

      {t.cloturesAValider > 0 && (
        <Link
          href="/caisse"
          className="bg-brand-soft min-h-11 rounded-lg p-3 text-sm font-semibold"
        >
          {t.cloturesAValider} caisse{t.cloturesAValider > 1 ? "s" : ""} à
          valider →
        </Link>
      )}

      <section
        aria-label="Chiffres du jour"
        className="kaya-dashboard-kpis grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <div
          className={carte}
          style={{ background: "linear-gradient(180deg,#ff8b1a,#f26a0f)", color: "#fff" }}
        >
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-white/25 text-white"><ShoppingBag size={20} /></span>
          <p className="text-white text-sm">
            Ventes du jour ({t.nbVentes} vente{t.nbVentes > 1 ? "s" : ""})
          </p>
          <p className="text-xl font-extrabold break-words">{formatFcfa(t.ventesTotal)}</p>
          <p className="text-white text-sm">
            Hier : {formatFcfa(t.ventesHier)}
            {variation !== null &&
              ` (${variation > 0 ? "+" : ""}${variation} %)`}
          </p>
        </div>
        <Link href="/caisse" className={carte} style={{ background: "#dff4e7" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Banknote size={20} /></span>
          <p className="text-muted text-sm">Espèces attendues en caisse</p>
          <p className="text-xl font-extrabold break-words">{formatFcfa(t.especesAttendues)}</p>
          <p className="text-muted text-sm">
            MTN {formatFcfa(t.mtnMomo)} · Orange {formatFcfa(t.orangeMoney)}
          </p>
        </Link>
        <Link href="/clients/dettes" className={carte} style={{ background: "#e4edff" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><Users size={20} /></span>
          <p className="text-muted text-sm">Ce que les clients vous doivent</p>
          <p className="text-xl font-extrabold break-words">{formatFcfa(t.dettes.total)}</p>
          <p className="text-muted text-sm">
            {t.dettes.nbClients} client{t.dettes.nbClients > 1 ? "s" : ""}
          </p>
        </Link>
        <Link href="/stock?bas=1" className={carte} style={{ background: "#fde9da" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><Boxes size={20} /></span>
          <p className="text-muted text-sm">Produits en stock bas</p>
          <p
            className={`text-xl font-extrabold break-words ${t.stockBas.nombre > 0 ? "text-danger" : ""}`}
          >
            {t.stockBas.nombre}
          </p>
          <p className="text-muted text-sm">
            Dépenses du jour : {formatFcfa(t.depensesTotal)}
          </p>
        </Link>
      </section>

      {rapport && (
        <section aria-label="Évolution des ventes" className="kaya-dashboard-panel flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Évolution des ventes (7 jours)</h2>
            <Link href="/rapports" className="text-sm font-bold text-orange-600">
              Voir plus →
            </Link>
          </div>
          <CourbeVentes points={rapport.serie} />
        </section>
      )}

      <section aria-label="Ventes par vendeur" className="kaya-dashboard-panel flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ventes par vendeur</h2>
        {t.vendeurs.length === 0 ? (
          <p className="text-muted">
            Aucune vente pour le moment aujourd&apos;hui.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {t.vendeurs.map((v) => (
              <li
                key={v.vendeurId}
                className="border-border flex items-baseline justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="font-medium">
                  {v.nom}{" "}
                  <span className="text-muted font-normal">
                    ({v.nbVentes} vente{v.nbVentes > 1 ? "s" : ""})
                  </span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {formatFcfa(v.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Produits les plus vendus"
        className="kaya-dashboard-panel flex flex-col gap-2"
      >
        <h2 className="text-lg font-semibold">
          Produits les plus vendus (7 jours)
        </h2>
        {t.produitsVendus.length === 0 ? (
          <p className="text-muted">Pas encore de vente cette semaine.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {t.produitsVendus.map((p) => (
              <li key={p.produitId} className="flex flex-col gap-1 text-sm">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{p.nom}</span>
                  <span className="whitespace-nowrap">
                    {formatQuantite(p.quantiteBase)} {p.uniteBase} ·{" "}
                    {formatFcfa(p.montant)}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="bg-brand-soft block h-2 rounded-full"
                >
                  <span
                    className="bg-brand-strong block h-2 rounded-full"
                    style={{
                      width: `${Math.round((p.montant / maxVendu) * 100)}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {t.stockBas.nombre > 0 && (
        <section aria-label="Stock bas" className="kaya-dashboard-panel flex flex-col gap-2">
          <h2 className="text-lg font-semibold">À réapprovisionner</h2>
          <ul className="flex flex-col gap-2">
            {t.stockBas.produits.map((p) => (
              <li key={p.produitId}>
                <Link
                  href={`/stock/${p.produitId}`}
                  className="border-border flex min-h-11 items-baseline justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium">{p.nom}</span>
                  <span className="text-danger font-semibold whitespace-nowrap">
                    {formatQuantite(p.stock)} {p.uniteBase} (seuil{" "}
                    {formatQuantite(p.seuil)})
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {t.stockBas.nombre > t.stockBas.produits.length && (
            <Link
              href="/stock?bas=1"
              className="text-sm font-semibold underline"
            >
              Voir les {t.stockBas.nombre} produits
            </Link>
          )}
        </section>
      )}

      <section aria-label="Alertes récentes" className="kaya-alert flex flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold">Alertes récentes</h2>
        {alertes.length === 0 ? (
          <p className="text-muted">Aucune alerte. Tout est calme.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alertes.map((a) => {
              const lien = lienEntite(a.entite, a.entiteId, a.details);
              const contenu = (
                <>
                  <span className="font-medium">{libelleAction(a.action)}</span>
                  <br />
                  {decrire(a.action, a.details)}
                  <br />
                  <span className="text-muted">
                    {formatDateHeure(a.creeLe)}
                  </span>
                </>
              );
              return (
                <li key={a.id}>
                  {lien ? (
                    <Link
                      href={lien}
                      className="border-danger block min-h-11 rounded-lg border p-3 text-sm"
                    >
                      {contenu}
                    </Link>
                  ) : (
                    <p className="border-danger rounded-lg border p-3 text-sm">
                      {contenu}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Link
          href="/journal?alertes=1"
          className="text-sm font-semibold underline"
        >
          Voir toutes les alertes
        </Link>
      </section>
      <p className="text-muted text-xs">
        Journée du {jourDouala()} (heure de Douala).
      </p>
    </div>
  );
}
