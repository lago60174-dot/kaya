import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnulerCommande } from "@/components/fournisseurs/actions-fournisseur";
import { ReceptionCommande } from "@/components/fournisseurs/reception-commande";
import {
  COULEUR_STATUT_COMMANDE,
  actionsCommande,
  libelleStatutCommande,
  messageCommande,
  totalLigneCommande,
} from "@/lib/fournisseurs/fournisseurs";
import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { lienWhatsApp } from "@/lib/ventes/whatsapp";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { lireCommande } from "@/server/fournisseurs/lecture";

export const metadata = { title: "Commande · Kaya" };

export default async function PageCommande({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cree?: string }>;
}) {
  await exigerFournisseurs();
  const [{ id }, { cree }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await lireCommande(await supabaseServeur(), id);
  if (!c) notFound();
  const peut = actionsCommande(c.statut);
  const message = messageCommande(c.boutiqueNom, c.numero, c.lignes, c.note, c.date);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      {cree === "1" && (
        <p role="status" className="bg-brand-soft text-success rounded-lg p-3 font-semibold">
          Commande enregistrée. Envoyez-la au fournisseur par WhatsApp, puis recevez la marchandise à son arrivée.
        </p>
      )}
      <div className="border-border flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{c.numero}</h1>
            <p className="text-muted text-sm">
              <Link href={`/fournisseurs/${c.fournisseur.id}`} className="font-semibold underline">{c.fournisseur.nom}</Link> · {formatDateHeure(c.date)}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${COULEUR_STATUT_COMMANDE[c.statut]}`}>{libelleStatutCommande(c.statut)}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {c.lignes.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3">
              <span>
                <span className="font-semibold">{l.nom}</span>
                <span className="text-muted block text-sm">
                  {formatQuantite(l.quantite)} {l.unite} × {formatFcfa(l.prixAchat)}
                </span>
                <span className="text-muted block text-sm">Reçu : {formatQuantite(l.recue)} sur {formatQuantite(l.quantite)}</span>
              </span>
              <span className="font-semibold">{formatFcfa(totalLigneCommande(l.quantite, l.prixAchat))}</span>
            </li>
          ))}
        </ul>
        <p className="border-border flex justify-between border-t pt-2 text-lg font-bold">
          <span>Total</span>
          <span>{formatFcfa(c.total)}</span>
        </p>
        {c.note && <p className="text-sm">{c.note}</p>}
        {c.motifAnnulation && <p className="text-sm"><b>Motif d&apos;annulation :</b> {c.motifAnnulation}</p>}
        {c.receptions.length > 0 && (
          <div>
            <p className="font-semibold">Réceptions</p>
            <ul className="text-muted text-sm">
              {c.receptions.map((r) => (
                <li key={r.id}>{formatDateHeure(r.date)} : {formatFcfa(r.montant)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {c.statut !== "annulee" && (
        <a
          href={lienWhatsApp(c.fournisseur.telephone, message)}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border flex min-h-11 max-w-md items-center justify-center rounded-lg border px-4 font-semibold"
        >
          Envoyer la commande par WhatsApp
        </a>
      )}
      {peut.recevoir && <ReceptionCommande commandeId={c.id} lignes={c.lignes} />}
      {peut.annuler && <AnnulerCommande commandeId={c.id} />}
    </div>
  );
}
