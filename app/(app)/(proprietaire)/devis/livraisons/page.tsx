import { Truck } from "lucide-react";
import Link from "next/link";
import { formatDateHeure } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerDevis } from "@/server/devis/acces";
import { listerBons } from "@/server/devis/lecture";

export const metadata = { title: "Bons de livraison · Kaya" };

export default async function PageBons() {
  const { boutiqueId } = await exigerDevis();
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const bons = await listerBons(await supabaseServeur(), boutiqueId);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
          <Truck aria-hidden="true" size={26} />
        </span>
        <h1 className="flex-1 text-xl font-bold">Bons de livraison</h1>
        <Link href="/devis" className="border-border flex min-h-11 items-center rounded-lg border bg-white px-4 font-semibold">
          Devis
        </Link>
      </div>
      {bons.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          Aucun bon de livraison. Créez-en un depuis un reçu de vente ou un devis accepté.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bons.map((b) => (
            <li key={b.id}>
              <Link
                href={`/devis/livraisons/${b.id}`}
                className="border-border hover:bg-brand-soft flex min-h-11 flex-col rounded-2xl border bg-white p-3 shadow-sm"
              >
                <span className="font-bold">{b.numero}</span>
                <span className="text-muted truncate text-sm">
                  {formatDateHeure(b.date)} · {b.source}
                  {b.client && ` · ${b.client}`}
                </span>
                {b.adresse_livraison && (
                  <span className="text-muted truncate text-sm">{b.adresse_livraison}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
