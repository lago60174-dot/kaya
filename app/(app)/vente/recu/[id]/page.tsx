import { notFound } from "next/navigation";
import { ActionsRecu } from "@/components/vente/actions-recu";
import { Recu } from "@/components/vente/recu";
import { peutUtiliser } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { lienWhatsApp, messageRecu } from "@/lib/ventes/whatsapp";
import { exigerRole } from "@/server/auth/session";
import { lireRecu } from "@/server/ventes/lecture";

export const metadata = { title: "Reçu · Kaya" };

export default async function PageRecu({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ succes?: string }>;
}) {
  const profil = await exigerRole("boutique");
  const [{ id }, { succes }] = await Promise.all([params, searchParams]);
  const recu = await lireRecu(await supabaseServeur(), id);
  if (!recu) notFound();

  const message = messageRecu({
    boutique: recu.boutique.nom,
    numero: recu.numeroRecu,
    date: recu.date,
    annule: recu.annule,
    lignes: recu.lignes.map((l) => ({
      nom: l.nom,
      quantite: l.quantite,
      unite: l.unite,
      total: l.total,
    })),
    remise: recu.remise,
    total: recu.total,
    paiements: recu.paiements,
    credit: recu.credit,
  });

  return (
    <div className="flex flex-col gap-4">
      {succes === "1" && (
        <p
          role="status"
          className="bg-brand-soft text-success max-w-md rounded-lg p-3 font-semibold"
        >
          Vente enregistrée.
        </p>
      )}
      <Recu recu={recu} />
      <ActionsRecu
        lienWhatsApp={lienWhatsApp(recu.client?.telephone, message)}
        peutImprimer={Boolean(
          profil.plan && peutUtiliser(profil.plan, "impression"),
        )}
      />
    </div>
  );
}
