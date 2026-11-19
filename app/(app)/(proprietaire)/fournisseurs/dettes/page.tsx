import Link from "next/link";
import { PaiementDette } from "@/components/fournisseurs/actions-fournisseur";
import { OngletsFournisseurs } from "@/components/fournisseurs/onglets";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { listerDettes } from "@/server/fournisseurs/lecture";

export const metadata = { title: "Dettes fournisseurs · Kaya" };

export default async function PageDettes() {
  const { boutiqueId } = await exigerFournisseurs();
  if (!boutiqueId) return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const dettes = await listerDettes(await supabaseServeur(), boutiqueId);
  const total = dettes.reduce((t, d) => t + d.solde, 0);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Ce que je dois aux fournisseurs</h1>
      <OngletsFournisseurs actif="/fournisseurs/dettes" />
      {dettes.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">Vous ne devez rien à vos fournisseurs. 🎉</p>
      ) : (
        <>
          <p className="bg-brand-soft rounded-lg p-3 text-lg font-bold">Total dû : {formatFcfa(total)}</p>
          <ul className="flex flex-col gap-2">
            {dettes.map((d) => (
              <li key={d.id} className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm">
                <p className="flex justify-between gap-2">
                  <Link href={`/fournisseurs/${d.fournisseur_id}`} className="font-bold underline">{d.fournisseur_nom}</Link>
                  <b>{formatFcfa(d.solde)}</b>
                </p>
                <p className="text-muted text-sm">
                  <Link href={`/fournisseurs/commandes/${d.commande_id}`} className="underline">{d.commande_numero}</Link> reçue le {formatDateHeure(d.cree_le)} · déjà payé {formatFcfa(d.paye)} sur {formatFcfa(d.montant)}
                </p>
                <PaiementDette detteId={d.id} solde={d.solde} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
