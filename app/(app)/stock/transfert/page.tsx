import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireTransfert } from "@/components/stock/formulaire-transfert";
import { formatDateHeure, formatQuantite } from "@/lib/format";
import { peutUtiliser } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { listerTransferts } from "@/server/stock/lecture";

export const metadata = { title: "Transfert de stock · Kaya" };

export default async function PageTransfert() {
  const profil = await exigerRole("proprietaire");
  if (!profil.plan || !peutUtiliser(profil.plan, "multi_boutiques") || profil.boutiques.length < 2)
    redirect("/stock");
  const modifiables = profil.boutiques.filter((b) => b.enEcriture);
  const noms = new Map(profil.boutiques.map((b) => [b.id, b.nom]));
  const historique = await listerTransferts(await supabaseServeur());

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/stock" className="text-sm font-semibold text-orange-600">← Produits &amp; Stock</Link>
        <h1 className="text-xl font-bold">Transférer du stock</h1>
        <p className="text-muted text-sm">
          Déplacez des produits d&apos;une boutique à l&apos;autre. Ce n&apos;est ni une perte ni un achat : le stock total
          ne change pas.
        </p>
      </header>

      {modifiables.length < 2 ? (
        <p className="bg-brand-soft rounded-lg p-3 text-sm">
          Il faut au moins deux boutiques modifiables pour transférer du stock.
        </p>
      ) : (
        <FormulaireTransfert
          boutiques={profil.boutiques}
          sourceInitiale={
            modifiables.find((b) => b.id === profil.boutiqueActiveId)?.id ?? modifiables[0].id
          }
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Derniers transferts</h2>
        {historique.length === 0 ? (
          <p className="text-muted text-sm">Aucun transfert pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {historique.map((t) => (
              <li key={t.id} className="border-border flex flex-col gap-1 rounded-xl border bg-white p-3 text-sm">
                <p className="font-semibold">
                  {noms.get(t.boutiqueSource) ?? "Boutique"} → {noms.get(t.boutiqueDestination) ?? "Boutique"}
                </p>
                <p className="text-muted">{formatDateHeure(t.date)}{t.note ? ` · ${t.note}` : ""}</p>
                <p>{t.lignes.map((l) => `${l.nom} : ${formatQuantite(l.quantite)} ${l.unite}`).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
