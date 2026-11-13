import { notFound } from "next/navigation";
import { ArchiverClient } from "@/components/clients/archiver-client";
import { FormulaireClient } from "@/components/clients/formulaire-client";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireFicheClient } from "@/server/clients/lecture";

export const metadata = { title: "Modifier le client · Kaya" };

export default async function PageModifierClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profil = await exigerRole("proprietaire");
  const { id } = await params;
  const fiche = await lireFicheClient(
    await supabaseServeur(),
    id,
    profil.boutiqueIds[0] ?? "",
  );
  if (!fiche) notFound();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Modifier {fiche.client.nom}</h1>
      <FormulaireClient
        initial={fiche.client}
        peutFixerPlafond
        plafondParDefaut={fiche.plafondParDefaut}
      />
      <ArchiverClient clientId={fiche.client.id} nom={fiche.client.nom} />
    </div>
  );
}
