import { notFound } from "next/navigation";
import { formatFcfa } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { payerAction } from "@/server/abonnement/actions";

export const metadata = {
  title: "Régler mon abonnement · Kaya",
  robots: { index: false },
};

/**
 * Page publique, ouverte depuis le message WhatsApp : l'identifiant de facture (UUID) tient lieu de clé.
 * Elle n'affiche que le nom de la boutique, le montant et l'état. Pas besoin d'être connecté pour payer.
 */
export default async function PagePayer({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { id } = await params;
  const { erreur } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: f } = await supabaseAdmin()
    .from("factures_abonnement")
    .select("id, type, montant_brut, statut, organisations(nom), plans(nom)")
    .eq("id", id)
    .maybeSingle();
  if (!f) notFound();
  const org = f.organisations as unknown as { nom: string } | null;
  const plan = f.plans as unknown as { nom: string } | null;
  const objet =
    f.type === "installation"
      ? "Frais d'installation"
      : `Abonnement Kaya${plan ? ` ${plan.nom}` : ""}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Régler mon abonnement</h1>
      <div className="border-border flex flex-col gap-1 rounded-lg border p-4">
        <p className="text-muted text-sm">{org?.nom}</p>
        <p className="font-medium">{objet}</p>
        <p className="text-3xl font-bold">
          {formatFcfa(Number(f.montant_brut))}
        </p>
      </div>
      {f.statut === "payee" ? (
        <p role="status" className="bg-brand-soft rounded-lg p-4 font-medium">
          Paiement reçu. Merci ! Votre abonnement est à jour.
        </p>
      ) : f.statut === "annulee" ? (
        <p className="bg-brand-soft rounded-lg p-4">
          Cette facture n&apos;est plus à régler. Ouvrez Kaya pour voir votre
          abonnement.
        </p>
      ) : (
        <form action={payerAction} className="flex flex-col gap-3">
          <input type="hidden" name="factureId" value={f.id} />
          {erreur && (
            <p role="alert" className="text-danger text-sm">
              Le paiement n&apos;a pas pu être préparé. Réessayez dans un
              instant.
            </p>
          )}
          <button
            type="submit"
            className="bg-brand min-h-12 rounded-lg px-4 text-lg font-semibold text-white"
          >
            Payer avec Mobile Money
          </button>
          <p className="text-muted text-sm">
            Orange Money ou MTN Mobile Money, via Fapshi. Si vous venez de
            payer, la confirmation peut prendre quelques instants : rechargez
            cette page.
          </p>
        </form>
      )}
    </main>
  );
}
