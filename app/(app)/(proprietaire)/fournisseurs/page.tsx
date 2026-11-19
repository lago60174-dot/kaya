import { Plus } from "lucide-react";
import Link from "next/link";
import { OngletsFournisseurs } from "@/components/fournisseurs/onglets";
import { formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { listerFournisseurs } from "@/server/fournisseurs/lecture";

export const metadata = { title: "Fournisseurs · Kaya" };

export default async function PageFournisseurs() {
  const { boutiqueId } = await exigerFournisseurs();
  if (!boutiqueId) return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const liste = await listerFournisseurs(await supabaseServeur(), boutiqueId);
  const total = liste.reduce((t, f) => t + f.du, 0);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Fournisseurs</h1>
      <OngletsFournisseurs actif="/fournisseurs" />
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/fournisseurs/nouveau" className="bg-brand-strong flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-white">
          <Plus aria-hidden="true" size={20} /> Nouveau fournisseur
        </Link>
        <Link href="/fournisseurs/commandes/nouveau" className="border-border flex min-h-11 items-center rounded-lg border bg-white px-4 font-semibold">
          Nouvelle commande
        </Link>
      </div>
      {total > 0 && <p className="bg-brand-soft rounded-lg p-3 font-semibold">Total dû aux fournisseurs : {formatFcfa(total)}</p>}
      {liste.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">Aucun fournisseur. Ajoutez le premier pour suivre vos commandes et ce que vous devez.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liste.map((f) => (
            <li key={f.id}>
              <Link href={`/fournisseurs/${f.id}`} className="border-border hover:bg-brand-soft flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-sm">
                <span className="min-w-0">
                  <span className="block font-bold">{f.nom}</span>
                  {f.telephone && <span className="text-muted block truncate text-sm">{f.telephone}</span>}
                </span>
                <span className={f.du > 0 ? "font-semibold text-orange-700" : "text-muted text-sm"}>
                  {f.du > 0 ? `Dû : ${formatFcfa(f.du)}` : "Rien à payer"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
