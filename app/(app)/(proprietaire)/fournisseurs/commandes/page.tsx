import Link from "next/link";
import { OngletsFournisseurs } from "@/components/fournisseurs/onglets";
import {
  COULEUR_STATUT_COMMANDE,
  STATUTS_COMMANDE,
  libelleStatutCommande,
} from "@/lib/fournisseurs/fournisseurs";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { listerCommandes } from "@/server/fournisseurs/lecture";

export const metadata = { title: "Commandes · Kaya" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PageCommandes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { boutiqueId } = await exigerFournisseurs();
  const p = await searchParams;
  if (!boutiqueId) return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const statut = STATUTS_COMMANDE.find((s) => s.code === p.statut)?.code;
  const apresDate = p.apres_date && !Number.isNaN(Date.parse(p.apres_date)) ? p.apres_date : undefined;
  const apresId = p.apres_id && UUID.test(p.apres_id) ? p.apres_id : undefined;
  const page = await listerCommandes(await supabaseServeur(), boutiqueId, {
    statut,
    ...(apresDate && apresId ? { apresDate, apresId } : {}),
  });
  const puce = (actif: boolean) =>
    `flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${actif ? "bg-orange-500 text-white" : "border-border border bg-white"}`;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Commandes aux fournisseurs</h1>
      <OngletsFournisseurs actif="/fournisseurs/commandes" />
      <Link href="/fournisseurs/commandes/nouveau" className="bg-brand-strong flex min-h-11 max-w-xs items-center justify-center rounded-lg px-4 font-semibold text-white">
        Nouvelle commande
      </Link>
      <div role="group" aria-label="Statut" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link href="/fournisseurs/commandes" className={puce(!statut)}>Toutes</Link>
        {STATUTS_COMMANDE.map((s) => (
          <Link key={s.code} href={`/fournisseurs/commandes?statut=${s.code}`} className={puce(statut === s.code)}>{s.libelle}</Link>
        ))}
      </div>
      {page.commandes.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">Aucune commande{statut ? " avec ce statut" : " pour le moment"}.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {page.commandes.map((c) => (
            <li key={c.id}>
              <Link href={`/fournisseurs/commandes/${c.id}`} className="border-border hover:bg-brand-soft flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-sm">
                <span className="min-w-0">
                  <span className="block font-bold">{c.numero}</span>
                  <span className="text-muted block truncate text-sm">{c.fournisseur_nom} · {formatDateHeure(c.cree_le)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-semibold">{formatFcfa(c.total)}</span>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${COULEUR_STATUT_COMMANDE[c.statut]}`}>{libelleStatutCommande(c.statut)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {page.suivant && (
        <Link
          href={`/fournisseurs/commandes?${new URLSearchParams({ ...(statut ? { statut } : {}), apres_date: page.suivant.date, apres_id: page.suivant.id })}`}
          className="border-border flex min-h-11 items-center justify-center rounded-lg border font-medium"
        >
          Voir la suite
        </Link>
      )}
    </div>
  );
}
