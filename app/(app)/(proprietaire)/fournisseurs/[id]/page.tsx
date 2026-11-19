import Link from "next/link";
import { notFound } from "next/navigation";
import { PaiementDette } from "@/components/fournisseurs/actions-fournisseur";
import { FormulaireFournisseur } from "@/components/fournisseurs/formulaire-fournisseur";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { listerDettes, lireFournisseur } from "@/server/fournisseurs/lecture";

export const metadata = { title: "Fournisseur · Kaya" };

export default async function PageFournisseur({ params }: { params: Promise<{ id: string }> }) {
  const { boutiqueId } = await exigerFournisseurs();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !boutiqueId) notFound();
  const supabase = await supabaseServeur();
  const f = await lireFournisseur(supabase, id);
  if (!f) notFound();
  const dettes = await listerDettes(supabase, boutiqueId, id);
  const du = dettes.reduce((t, d) => t + d.solde, 0);
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <Link href="/fournisseurs" className="text-sm font-semibold underline">Fournisseurs</Link>
        <h1 className="text-xl font-bold">{f.nom}</h1>
        <p className="font-semibold">{du > 0 ? `Vous devez ${formatFcfa(du)}` : "Vous ne devez rien à ce fournisseur."}</p>
      </div>
      <Link href={`/fournisseurs/commandes/nouveau?fournisseur=${f.id}`} className="bg-brand-strong flex min-h-11 max-w-md items-center justify-center rounded-lg px-4 font-semibold text-white">
        Nouvelle commande
      </Link>
      {dettes.length > 0 && (
        <section aria-label="Dettes" className="flex flex-col gap-2">
          <h2 className="font-bold">À payer</h2>
          <ul className="flex flex-col gap-2">
            {dettes.map((d) => (
              <li key={d.id} className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm">
                <p className="flex justify-between gap-2">
                  <Link href={`/fournisseurs/commandes/${d.commande_id}`} className="font-semibold underline">{d.commande_numero}</Link>
                  <b>{formatFcfa(d.solde)}</b>
                </p>
                <p className="text-muted text-sm">
                  Reçue le {formatDateHeure(d.cree_le)} · {formatFcfa(d.montant)} au total, {formatFcfa(d.paye)} déjà payé
                </p>
                <PaiementDette detteId={d.id} solde={d.solde} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="Fiche" className="flex flex-col gap-2">
        <h2 className="font-bold">Fiche</h2>
        <FormulaireFournisseur initial={{ id: f.id, nom: f.nom, telephone: f.telephone, adresse: f.adresse, notes: f.notes }} />
      </section>
    </div>
  );
}
