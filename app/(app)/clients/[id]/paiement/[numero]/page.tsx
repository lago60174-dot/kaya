import { notFound } from "next/navigation";
import { ActionsPaiement } from "@/components/clients/actions-paiement";
import { RecuPaiement } from "@/components/clients/recu-paiement";
import { messagePaiement } from "@/lib/clients/messages";
import { peutUtiliser } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { lienWhatsApp } from "@/lib/ventes/whatsapp";
import { exigerRole } from "@/server/auth/session";
import { lirePaiementCredit } from "@/server/clients/lecture";

export const metadata = { title: "Reçu de paiement · Kaya" };

export default async function PagePaiement({
  params,
}: {
  params: Promise<{ id: string; numero: string }>;
}) {
  const profil = await exigerRole("boutique");
  const { id, numero } = await params;
  const p = await lirePaiementCredit(
    await supabaseServeur(),
    id,
    profil.boutiqueIds[0] ?? "",
    numero,
  );
  if (!p) notFound();
  return (
    <div className="flex flex-col gap-4">
      <p
        role="status"
        className="bg-brand-soft text-success max-w-md rounded-lg p-3 font-semibold"
      >
        Paiement enregistré.
      </p>
      <RecuPaiement p={p} />
      <ActionsPaiement
        lienWhatsApp={lienWhatsApp(p.clientTelephone, messagePaiement(p))}
        clientId={id}
        peutImprimer={Boolean(
          profil.plan && peutUtiliser(profil.plan, "impression"),
        )}
      />
    </div>
  );
}
