import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionsDevis } from "@/components/devis/actions-devis";
import { FormulaireBon } from "@/components/devis/formulaire-bon";
import { ActionsRecu } from "@/components/vente/actions-recu";
import {
  COULEUR_STATUT_DEVIS,
  actionsPossibles,
  changementsDePrix,
  estExpire,
  formatJour,
  jourDouala,
  libelleStatutDevis,
  libelleTypeDevis,
  messageDevis,
  totalAuxPrixActuels,
} from "@/lib/devis/devis";
import { formatFcfa, formatQuantite } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { lienWhatsApp } from "@/lib/ventes/whatsapp";
import { exigerDevis } from "@/server/devis/acces";
import { lireDevis, lirePrixActuels } from "@/server/devis/lecture";

export const metadata = { title: "Devis · Kaya" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PageFicheDevis({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ envoye?: string }>;
}) {
  await exigerDevis();
  const [{ id }, { envoye }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const supabase = await supabaseServeur();
  const d = await lireDevis(supabase, id);
  if (!d) notFound();

  const peut = actionsPossibles(d.statut);
  const expire = estExpire(d.statut, d.valideJusqu, jourDouala());
  const prix = peut.convertir
    ? await lirePrixActuels(supabase, d.lignes.map((l) => l.uniteId))
    : null;
  const changements = prix ? changementsDePrix(d.lignes, prix) : [];
  const totalVente = prix ? totalAuxPrixActuels(d.lignes, prix, d.remise) : d.total;
  const titre = d.numero ?? `${libelleTypeDevis(d.type)} (brouillon)`;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      {envoye === "1" && (
        <p role="status" className="bg-brand-soft text-success rounded-lg p-3 font-semibold">
          {libelleTypeDevis(d.type)} envoyé. Partagez-le au client avec le bouton WhatsApp.
        </p>
      )}
      <div className="border-border flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{titre}</h1>
            <p className="text-muted text-sm">
              {d.client?.nom ?? "Sans client"} · valable jusqu&apos;au {formatJour(d.valideJusqu)}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${COULEUR_STATUT_DEVIS[d.statut]}`}>
            {libelleStatutDevis(d.statut)}
          </span>
        </div>
        {expire && (
          <p role="status" className="bg-brand-soft rounded-lg p-2 text-sm">
            La date de validité est dépassée. Les prix peuvent avoir changé : vérifiez avant de vendre.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {d.lignes.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span>
                <span className="font-semibold">{l.nom}</span>
                <span className="text-muted block text-sm">
                  {formatQuantite(l.quantite)} {l.unite} × {formatFcfa(l.prixUnitaire)}
                </span>
              </span>
              <span className="font-semibold">{formatFcfa(l.total)}</span>
            </li>
          ))}
        </ul>
        <div className="border-border flex flex-col gap-1 border-t pt-2">
          {d.remise > 0 && (
            <p className="flex justify-between text-sm">
              <span>Remise</span>
              <span>-{formatFcfa(d.remise)}</span>
            </p>
          )}
          <p className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatFcfa(d.total)}</span>
          </p>
        </div>
        {d.conditions && <p className="text-sm"><b>Conditions :</b> {d.conditions}</p>}
        {d.note && <p className="text-sm">{d.note}</p>}
        {d.vente && (
          <p className="text-sm">
            Converti en vente :{" "}
            <Link className="font-semibold underline" href={`/vente/recu/${d.vente.id}`}>
              reçu {d.vente.numeroRecu}
            </Link>
          </p>
        )}
      </div>

      {changements.length > 0 && (
        <div role="status" className="bg-brand-soft rounded-lg p-3 text-sm">
          <p className="font-semibold">
            Les prix ont changé depuis ce devis. La vente utilisera les prix d&apos;aujourd&apos;hui
            {totalVente !== null && ` : ${formatFcfa(totalVente)} au lieu de ${formatFcfa(d.total)}`}.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {changements.map((c, i) => (
              <li key={i}>
                {c.nom} ({c.unite}) : {formatFcfa(c.ancien)} →{" "}
                {c.actuel === null ? "n'est plus en vente" : formatFcfa(c.actuel)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.statut === "brouillon" && (
        <Link
          href={`/devis/${d.id}/modifier`}
          className="bg-brand-strong flex min-h-11 max-w-md items-center justify-center rounded-lg px-4 font-semibold text-white"
        >
          Modifier et envoyer
        </Link>
      )}
      {peut.partager && d.numero && (
        <ActionsRecu
          lienWhatsApp={lienWhatsApp(d.client?.telephone, messageDevis(d))}
          message={messageDevis(d)}
          pdfUrl={`/devis/${d.id}/pdf`}
          nomFichier={`${d.numero}.pdf`}
          numero={d.numero}
          escposUrl=""
          peutImprimer={false}
          suite={{ href: "/devis", libelle: "Retour aux devis" }}
        />
      )}
      <ActionsDevis
        devisId={d.id}
        statut={d.statut}
        totalVente={totalVente}
        aUnClient={d.client !== null}
      />
      {peut.bonLivraison &&
        (d.bonLivraison ? (
          <Link
            href={`/devis/livraisons/${d.bonLivraison.id}`}
            className="border-border flex min-h-11 max-w-md items-center justify-center rounded-lg border px-4 font-semibold"
          >
            Voir le bon de livraison {d.bonLivraison.numero}
          </Link>
        ) : (
          <FormulaireBon source={{ devisId: d.id }} />
        ))}
    </div>
  );
}
