import { notFound } from "next/navigation";
import { RecuPaiement } from "@/components/clients/recu-paiement";
import { DocumentsImprimables } from "@/components/impression/documents";
import { ActionsRecu } from "@/components/vente/actions-recu";
import { messagePaiement } from "@/lib/clients/messages";
import { peutUtiliser } from "@/lib/plans";
import { documentDepuisPaiement } from "@/lib/print/document";
import { urlImage } from "@/server/images/cles";
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
    profil.boutiqueActiveId ?? "",
    numero,
  );
  if (!p) notFound();
  const peutImprimer = Boolean(
    profil.plan && peutUtiliser(profil.plan, "impression"),
  );
  const base = `/clients/${id}/paiement/${p.numero}`;
  const message = messagePaiement(p);
  return (
    <div className="flex flex-col gap-4">
      <p
        role="status"
        className="bg-brand-soft text-success max-w-md rounded-lg p-3 font-semibold"
      >
        Paiement enregistré.
      </p>
      <RecuPaiement p={p} />
      {peutImprimer && (
        <DocumentsImprimables
          doc={documentDepuisPaiement(p, p.mentionLegale)}
          logoUrl={p.logoCle ? urlImage(p.logoCle) : null}
        />
      )}
      <ActionsRecu
        lienWhatsApp={lienWhatsApp(p.clientTelephone, message)}
        message={message}
        pdfUrl={`${base}/pdf`}
        nomFichier={`Paiement-${p.numero}.pdf`}
        numero={p.numero}
        escposUrl={`${base}/escpos`}
        peutImprimer={peutImprimer}
        suite={{ href: `/clients/${id}`, libelle: "Retour au client" }}
      />
    </div>
  );
}
