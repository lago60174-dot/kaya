import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { Beigne } from "@/components/caisse/beigne";
import { CourbeVentes } from "@/components/patron/courbe-ventes";
import { formatFcfa, formatQuantite } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireClassementSemaine, lireRapport } from "@/server/patron/rapports";

export const metadata = { title: "Rapports · Kaya" };

const PERIODES = [
  [7, "7 jours"],
  [30, "30 jours"],
  [90, "90 jours"],
] as const;

export default async function PageRapports({ searchParams }: { searchParams: Promise<{ jours?: string; semaine?: string }> }) {
  const profil = await exigerRole("proprietaire");
  const recherche = await searchParams;
  const demande = Number(recherche.jours);
  const decalage = Math.min(52, Math.max(0, Math.trunc(Number(recherche.semaine)) || 0));
  const jours = PERIODES.some(([n]) => n === demande) ? demande : 7;
  const boutiqueId = profil.boutiqueActiveId;
  if (!boutiqueId) return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const r = await lireRapport(await supabaseServeur(), boutiqueId, jours);
  if (!r)
    return (
      <p role="alert" className="text-danger">
        Impossible de charger les rapports. Vérifiez votre connexion et rechargez la page.
      </p>
    );
  const semaine = await lireClassementSemaine(await supabaseServeur(), boutiqueId, decalage);
  const jourCourt = (d: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const lienSemaine = (n: number) => `/rapports?jours=${jours}&semaine=${n}#classement-semaine`;
  const panier = r.nbVentes > 0 ? Math.round(r.total / r.nbVentes) : 0;
  const maxVendu = Math.max(1, ...r.produits.map((p) => p.montant));
  const carte = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
          <ChartColumn aria-hidden="true" size={26} />
        </span>
        <h1 className="text-xl font-bold">Rapports &amp; Statistiques</h1>
      </div>

      <nav aria-label="Période" className="flex gap-2">
        {PERIODES.map(([n, libelle]) => (
          <Link
            key={n}
            href={`/rapports?jours=${n}`}
            aria-current={n === jours ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${n === jours ? "bg-orange-500 text-white" : "bg-white text-[#17233d] shadow-sm"}`}
          >
            {libelle}
          </Link>
        ))}
      </nav>


      {semaine && (
        <section id="classement-semaine" aria-label="Classement de la semaine" className={carte}>
          <h2 className="text-lg font-bold">Meilleurs vendeurs de la semaine</h2>
          <nav aria-label="Semaine" className="flex items-center justify-between gap-2 text-sm">
            {decalage < 52 ? (
              <Link href={lienSemaine(decalage + 1)} className="flex min-h-11 items-center rounded-full bg-orange-50 px-4 font-bold">
                ← Précédente
              </Link>
            ) : (
              <span />
            )}
            <span className="text-center font-bold">
              {decalage === 0 ? "Cette semaine · " : ""}
              {jourCourt(semaine.debut)} – {jourCourt(semaine.fin)}
            </span>
            {decalage > 0 ? (
              <Link href={lienSemaine(decalage - 1)} className="flex min-h-11 items-center rounded-full bg-orange-50 px-4 font-bold">
                Suivante →
              </Link>
            ) : (
              <span />
            )}
          </nav>
          {semaine.vendeurs.length === 0 ? (
            <p className="text-muted">Aucune vente cette semaine-là.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {semaine.vendeurs.map((v, i) => (
                <li key={v.vendeurId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-bold">
                    {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : `${i + 1}. `}
                    {v.nom} <span className="text-muted font-normal">({v.nbVentes} vente{v.nbVentes > 1 ? "s" : ""})</span>
                  </span>
                  <span className="font-extrabold whitespace-nowrap">{formatFcfa(v.total)}</span>
                </li>
              ))}
            </ol>
          )}
          {semaine.produits.length > 0 && (
            <>
              <h3 className="mt-2 font-bold">Produits les plus vendus cette semaine</h3>
              <ol className="flex flex-col gap-2">
                {semaine.produits.map((p, i) => (
                  <li key={p.produitId} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-bold">
                      {i + 1}. {p.nom}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatQuantite(p.quantiteBase)} {p.uniteBase} · {formatFcfa(p.montant)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      <section aria-label="Chiffres de la période" className="grid grid-cols-2 gap-3 text-center lg:grid-cols-4">
        <p className="rounded-2xl p-3 text-white" style={{ background: "linear-gradient(180deg,#ff8b1a,#f26a0f)" }}>
          <span className="block text-xs">Ventes totales</span>
          <b className="block text-base font-extrabold break-words">{formatFcfa(r.total)}</b>
        </p>
        <p className="rounded-2xl p-3" style={{ background: "#e4edff" }}>
          <span className="block text-xs">Nombre de ventes</span>
          <b className="block text-base font-extrabold">{r.nbVentes}</b>
        </p>
        {r.benefice !== null && (
          <p className="rounded-2xl p-3" style={{ background: "#fdeee3" }}>
            <span className="block text-xs">Bénéfice estimé</span>
            <b className="block text-base font-extrabold break-words">{formatFcfa(r.benefice)}</b>
          </p>
        )}
        <p className="rounded-2xl p-3" style={{ background: "#dff4e7" }}>
          <span className="block text-xs">Panier moyen</span>
          <b className="block text-base font-extrabold break-words">{formatFcfa(panier)}</b>
        </p>
      </section>

      <section aria-label="Évolution des ventes" className={carte}>
        <h2 className="text-lg font-bold">Évolution des ventes</h2>
        <CourbeVentes points={r.serie} />
      </section>

      {r.modes.length > 0 && (
        <section aria-label="Ventes par mode de paiement" className={carte}>
          <h2 className="text-lg font-bold">Ventes par mode de paiement</h2>
          <Beigne
            parts={r.modes.map((m) => ({
              libelle: m.mode === "mtn_momo" ? "MTN MoMo" : m.mode === "orange_money" ? "Orange Money" : "Espèces",
              montant: m.montant,
              couleur: m.mode === "mtn_momo" ? "#3b82f6" : m.mode === "orange_money" ? "#f5a000" : "#f26a0f",
            }))}
          />
        </section>
      )}

      <section aria-label="Produits les plus vendus" className={carte}>
        <h2 className="text-lg font-bold">Produits les plus vendus</h2>
        {r.produits.length === 0 ? (
          <p className="text-muted">Pas encore de vente sur cette période.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {r.produits.map((p, i) => (
              <li key={p.produitId} className="flex flex-col gap-1 text-sm">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-bold">
                    {i + 1}. {p.nom}
                  </span>
                  <span className="whitespace-nowrap">
                    {formatQuantite(p.quantiteBase)} {p.uniteBase} · {formatFcfa(p.montant)}
                  </span>
                </span>
                <span aria-hidden="true" className="block h-2 rounded-full bg-orange-100">
                  <span className="block h-2 rounded-full bg-orange-500" style={{ width: `${Math.round((p.montant / maxVendu) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Ventes par vendeur" className={carte}>
        <h2 className="text-lg font-bold">Performance des vendeurs</h2>
        {r.vendeurs.length === 0 ? (
          <p className="text-muted">Aucune vente sur cette période.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {r.vendeurs.map((v) => (
              <li key={v.vendeurId} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-bold">
                  {v.nom} <span className="text-muted font-normal">({v.nbVentes} vente{v.nbVentes > 1 ? "s" : ""})</span>
                </span>
                <span className="font-extrabold whitespace-nowrap">{formatFcfa(v.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
