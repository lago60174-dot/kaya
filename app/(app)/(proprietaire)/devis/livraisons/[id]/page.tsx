import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionsRecu } from "@/components/vente/actions-recu";
import { formatDateHeure, formatQuantite } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { lienWhatsApp } from "@/lib/ventes/whatsapp";
import { exigerDevis } from "@/server/devis/acces";
import { lireBon } from "@/server/devis/lecture";

export const metadata = { title: "Bon de livraison · Kaya" };

export default async function PageBon({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerDevis();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await lireBon(await supabaseServeur(), id);
  if (!b) notFound();
  const message = [
    `*${b.boutique.nom}*`,
    `Bon de livraison ${b.numero} · ${formatDateHeure(b.date)}`,
    "",
    ...b.lignes.map((l) => `• ${formatQuantite(l.quantite)} ${l.unite} ${l.nom}`),
    ...(b.adresse ? ["", `Livraison : ${b.adresse}`] : []),
    "",
    "Le PDF du bon de livraison est joint à ce message.",
  ].join("\n");
  const lienSource =
    b.source.type === "vente" ? `/vente/recu/${b.source.id}` : `/devis/${b.source.id}`;
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="border-border flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">Bon de livraison {b.numero}</h1>
          <p className="text-muted text-sm">
            {formatDateHeure(b.date)}
            {b.client && ` · ${b.client.nom}`}
          </p>
          <p className="text-sm">
            {b.source.type === "vente" ? "Reçu" : "Devis"}{" "}
            <Link href={lienSource} className="font-semibold underline">{b.source.numero}</Link>
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          {b.lignes.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="font-semibold">{l.nom}</span>
              <span>{formatQuantite(l.quantite)} {l.unite}</span>
            </li>
          ))}
        </ul>
        {b.adresse && <p className="text-sm"><b>Adresse :</b> {b.adresse}</p>}
        {b.note && <p className="text-sm">{b.note}</p>}
      </div>
      <ActionsRecu
        lienWhatsApp={lienWhatsApp(b.client?.telephone, message)}
        message={message}
        pdfUrl={`/devis/livraisons/${b.id}/pdf`}
        nomFichier={`${b.numero}.pdf`}
        numero={b.numero}
        escposUrl=""
        peutImprimer={false}
        suite={{ href: "/devis/livraisons", libelle: "Retour aux bons" }}
      />
    </div>
  );
}
