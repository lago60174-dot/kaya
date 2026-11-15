import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { CourbeVentes } from "@/components/patron/courbe-ventes";
import { formatFcfa, formatQuantite } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireRapport } from "@/server/patron/rapports";

export const metadata = { title: "Rapports · Kaya" };

const PERIODES = [
  [7, "7 jours"],
  [30, "30 jours"],
  [90, "90 jours"],
] as const;

export default async function PageRapports({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const profil = await exigerRole("proprietaire");
  const demande = Number((await searchParams).jours);
  const jours = PERIODES.some(([n]) => n === demande) ? demande : 7;
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId) return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const r = await lireRapport(await supabaseServeur(), boutiqueId, jours);
  if (!r)
    return (
      <p role="alert" className="text-danger">
        Impossible de charger les rapports. Vérifiez votre connexion et rechargez la page.
      </p>
    );
  const panier = r.nbVentes > 0 ? Math.round(r.total / r.nbVentes) : 0;
  const maxVendu = Math.max(1, ...r.produits.map((p) => p.montant));
  const carte = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
          <BarChart3 aria-hidden="true" size={26} />
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

      <section aria-label="Chiffres de la période" className="grid grid-cols-3 gap-3 text-center">
        <p className="rounded-2xl p-3 text-white" style={{ background: "linear-gradient(180deg,#ff8b1a,#f26a0f)" }}>
          <span className="block text-xs">Ventes totales</span>
          <b className="block text-base font-extrabold break-words">{formatFcfa(r.total)}</b>
        </p>
        <p className="rounded-2xl p-3" style={{ background: "#e4edff" }}>
          <span className="block text-xs">Nombre de ventes</span>
          <b className="block text-base font-extrabold">{r.nbVentes}</b>
        </p>
        <p className="rounded-2xl p-3" style={{ background: "#dff4e7" }}>
          <span className="block text-xs">Panier moyen</span>
          <b className="block text-base font-extrabold break-words">{formatFcfa(panier)}</b>
        </p>
      </section>

      <section aria-label="Évolution des ventes" className={carte}>
        <h2 className="text-lg font-bold">Évolution des ventes</h2>
        <CourbeVentes points={r.serie} />
      </section>

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
