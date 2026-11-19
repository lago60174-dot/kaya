import { FileText, Plus, Truck } from "lucide-react";
import Link from "next/link";
import {
  COULEUR_STATUT_DEVIS,
  STATUTS_DEVIS,
  estExpire,
  formatJour,
  jourDouala,
  libelleStatutDevis,
  libelleTypeDevis,
} from "@/lib/devis/devis";
import { filtresDevisDepuisParametres } from "@/lib/devis/filtres";
import { formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerDevis } from "@/server/devis/acces";
import { listerDevis } from "@/server/devis/lecture";

export const metadata = { title: "Devis · Kaya" };

export default async function PageDevis({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { boutiqueId } = await exigerDevis();
  const p = await searchParams;
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const filtres = filtresDevisDepuisParametres(p);
  const page = await listerDevis(await supabaseServeur(), boutiqueId, filtres);
  const aujourdhui = jourDouala();
  const filtre = Boolean(filtres.recherche || filtres.statut || filtres.type);
  const suite = page.suivant
    ? new URLSearchParams({
        ...(p as Record<string, string>),
        apres_date: page.suivant.date,
        apres_id: page.suivant.id,
      })
    : null;
  const lienStatut = (statut?: string) => {
    const q = new URLSearchParams();
    if (filtres.recherche) q.set("q", filtres.recherche);
    if (statut) q.set("statut", statut);
    return `/devis${q.size ? `?${q}` : ""}`;
  };
  const puce = (actif: boolean) =>
    `min-h-11 shrink-0 rounded-full px-4 text-sm font-bold flex items-center ${actif ? "bg-orange-500 text-white" : "border-border border bg-white"}`;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
          <FileText aria-hidden="true" size={26} />
        </span>
        <h1 className="flex-1 text-xl font-bold">Devis et proformas</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/devis/nouveau"
          className="bg-brand-strong flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-white"
        >
          <Plus aria-hidden="true" size={20} /> Nouveau devis
        </Link>
        <Link
          href="/devis/nouveau?type=proforma"
          className="border-border flex min-h-11 items-center rounded-lg border bg-white px-4 font-semibold"
        >
          Nouvelle proforma
        </Link>
        <Link
          href="/devis/livraisons"
          className="border-border flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 font-semibold"
        >
          <Truck aria-hidden="true" size={20} /> Bons de livraison
        </Link>
      </div>
      <form action="/devis" className="flex gap-2">
        {filtres.statut && <input type="hidden" name="statut" value={filtres.statut} />}
        <input
          type="search"
          name="q"
          defaultValue={filtres.recherche ?? ""}
          aria-label="Chercher un devis"
          placeholder="Numéro ou nom du client"
          className="border-border min-h-11 flex-1 rounded-lg border bg-white px-3 text-base"
        />
        <button type="submit" className="border-border min-h-11 rounded-lg border bg-white px-4 font-semibold">
          Chercher
        </button>
      </form>
      <div role="group" aria-label="Statut" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href={lienStatut()} className={puce(!filtres.statut)}>Tous</Link>
        {STATUTS_DEVIS.map((s) => (
          <Link key={s.code} href={lienStatut(s.code)} className={puce(filtres.statut === s.code)}>
            {s.libelle}
          </Link>
        ))}
      </div>
      {page.devis.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          {filtre
            ? "Aucun devis ne correspond à votre recherche."
            : "Aucun devis pour le moment. Créez le premier pour un client qui veut un prix avant d'acheter."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {page.devis.map((d) => (
            <li key={d.id}>
              <Link
                href={`/devis/${d.id}`}
                className="border-border hover:bg-brand-soft flex min-h-11 items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">
                    {d.numero ?? `${libelleTypeDevis(d.type)} (brouillon)`}
                  </span>
                  <span className="text-muted truncate text-sm">
                    {d.client_nom ?? "Sans client"} · valable jusqu&apos;au {formatJour(d.valide_jusqu)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold">{formatFcfa(d.total)}</span>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${COULEUR_STATUT_DEVIS[d.statut]}`}>
                    {libelleStatutDevis(d.statut)}
                  </span>
                  {estExpire(d.statut, d.valide_jusqu, aujourdhui) && (
                    <span className="text-danger text-xs font-medium">Expiré</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {suite && (
        <Link href={`/devis?${suite}`} className="border-border flex min-h-11 items-center justify-center rounded-lg border font-medium">
          Voir la suite
        </Link>
      )}
    </div>
  );
}
