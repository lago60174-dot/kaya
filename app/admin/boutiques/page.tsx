import Link from "next/link";
import { COULEUR_STATUT, LIBELLE_STATUT, dateSeule } from "@/lib/admin";
import { supabaseServeur } from "@/lib/supabase/server";
import { listerBoutiques } from "@/server/admin/lecture";

export const metadata = { title: "Boutiques · Administration Kaya" };

export default async function PageBoutiques({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; plan?: string }>;
}) {
  const { q, statut, plan } = await searchParams;
  const lignes = await listerBoutiques(await supabaseServeur(), {
    recherche: q?.slice(0, 60),
    statut: statut && statut in LIBELLE_STATUT ? statut : undefined,
    plan: plan && /^[a-z_]{2,20}$/.test(plan) ? plan : undefined,
  });
  const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";
  return (
    <>
      <h1 className="text-2xl font-bold">Boutiques</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Nom, ville, téléphone, email" aria-label="Rechercher" className={`${champ} min-w-60 flex-1`} />
        <select name="statut" defaultValue={statut ?? ""} aria-label="Statut" className={champ}>
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLE_STATUT).map(([c, l]) => (
            <option key={c} value={c}>
              {l}
            </option>
          ))}
        </select>
        <select name="plan" defaultValue={plan ?? ""} aria-label="Plan" className={champ}>
          <option value="">Tous les plans</option>
          <option value="essentiel">Essentiel</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <button type="submit" className="bg-brand-strong min-h-11 rounded-lg px-4 text-sm font-semibold text-white">
          Filtrer
        </button>
      </form>
      {!lignes ? (
        <p role="alert" className="text-danger">
          Impossible de charger les boutiques.
        </p>
      ) : lignes.length === 0 ? (
        <p className="text-muted">Aucune boutique ne correspond.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lignes.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/boutiques/${b.id}`}
                className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex min-w-0 flex-col">
                  <b className="truncate">{b.nom}</b>
                  <span className="text-muted truncate text-sm">
                    {[b.ville, b.telephone, b.email].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-full px-3 py-0.5 font-bold ${COULEUR_STATUT[b.statut] ?? ""}`}>{LIBELLE_STATUT[b.statut] ?? b.statut}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-0.5 font-bold capitalize">{b.plan}</span>
                  <span className="text-muted">
                    {b.ventes30j} vente{b.ventes30j > 1 ? "s" : ""} / 30 j · inscrite le {dateSeule(b.creeLe)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
