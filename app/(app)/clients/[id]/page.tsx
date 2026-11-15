import { Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormulairePaiement } from "@/components/clients/formulaire-paiement";
import { messageRappel } from "@/lib/clients/messages";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { libelleMode } from "@/lib/ventes/paiements";
import { lienWhatsApp } from "@/lib/ventes/whatsapp";
import { exigerRole } from "@/server/auth/session";
import { lireFicheClient } from "@/server/clients/lecture";

export const metadata = { title: "Client · Kaya" };

const lienBouton =
  "flex min-h-11 items-center rounded-full border border-border bg-white px-4 text-sm font-semibold";

export default async function PageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profil = await exigerRole("boutique");
  const { id } = await params;
  const fiche = await lireFicheClient(
    await supabaseServeur(),
    id,
    profil.boutiqueIds[0] ?? "",
  );
  if (!fiche) notFound();
  const { client, dette } = fiche;
  const plafond = client.plafondCredit ?? fiche.plafondParDefaut;
  const message = messageRappel({
    boutique: fiche.boutiqueNom,
    client: client.nom,
    dette,
    recus: fiche.creances.map((c) => c.numeroRecu),
  });

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <span
          aria-hidden="true"
          className="grid size-20 shrink-0 place-items-center rounded-full bg-orange-100 text-3xl font-bold text-orange-700"
        >
          {client.nom.charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-xl font-bold">{client.nom}</h1>
          {client.telephone && (
            <p className="text-muted flex items-center gap-2">
              <Phone aria-hidden="true" size={16} />
              {client.telephone}
            </p>
          )}
          {client.notes && <p className="text-sm">{client.notes}</p>}
        </div>
      </div>

      <section aria-label="Crédit" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <p className="rounded-2xl p-4" style={{ background: "#fdeee3" }}>
            <span className="block text-sm font-bold text-red-700">Crédit dû</span>
            <b className={`block text-xl font-extrabold ${dette > 0 ? "text-red-700" : ""}`}>
              {formatFcfa(dette)}
            </b>
          </p>
          <p className="rounded-2xl p-4" style={{ background: "#e4edff" }}>
            <span className="block text-sm font-bold text-blue-800">Encore disponible</span>
            <b className="block text-xl font-extrabold">
              {formatFcfa(Math.max(0, plafond - dette))}
            </b>
          </p>
        </div>
        <p className="text-muted text-sm">
          Plafond de crédit : {formatFcfa(plafond)}
          {client.plafondCredit === null && " (celui de la boutique)"}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {dette > 0 && (
          <a
            href={lienWhatsApp(client.telephone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-success flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white"
          >
            Rappeler sur WhatsApp
          </a>
        )}
        {client.telephone && (
          <a href={`tel:${client.telephone}`} className={lienBouton}>
            Appeler
          </a>
        )}
        {profil.role === "proprietaire" && (
          <Link href={`/clients/${client.id}/modifier`} className={lienBouton}>
            Modifier
          </Link>
        )}
      </div>

      {dette > 0 && (
        <>
          <section aria-label="Dettes en cours" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Dettes en cours</h2>
            <ul className="flex flex-col">
              {fiche.creances.map((c) => (
                <li
                  key={c.id}
                  className="border-border flex justify-between gap-2 border-b py-2 text-sm"
                >
                  <span>
                    {c.numeroRecu}
                    <span className="text-muted block text-xs">
                      {formatDateHeure(c.date)}
                    </span>
                  </span>
                  <span className="font-semibold">{formatFcfa(c.solde)}</span>
                </li>
              ))}
            </ul>
          </section>
          <FormulairePaiement
            clientId={client.id}
            creances={fiche.creances}
            dette={dette}
          />
        </>
      )}

      <section aria-label="Derniers paiements" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Derniers paiements</h2>
        {fiche.paiements.length === 0 ? (
          <p className="text-muted">Aucun paiement de crédit pour le moment.</p>
        ) : (
          <ul className="flex flex-col">
            {fiche.paiements.map((p) => (
              <li key={p.numero}>
                <Link
                  href={`/clients/${client.id}/paiement/${p.numero}`}
                  className="border-border hover:bg-brand-soft flex min-h-11 items-center justify-between gap-2 border-b py-2 text-sm"
                >
                  <span>
                    {p.numero}
                    <span className="text-muted block text-xs">
                      {formatDateHeure(p.date)} · {libelleMode(p.mode)}
                    </span>
                  </span>
                  <span className="text-success font-semibold">
                    {formatFcfa(p.montant)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Historique d'achats" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Historique d&apos;achats</h2>
        {fiche.achats.length === 0 ? (
          <p className="text-muted">Aucun achat enregistré pour ce client.</p>
        ) : (
          <ul className="flex flex-col">
            {fiche.achats.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/vente/recu/${a.id}`}
                  className="border-border hover:bg-brand-soft flex min-h-11 items-center justify-between gap-2 border-b py-2 text-sm"
                >
                  <span>
                    {a.numeroRecu}
                    <span className="text-muted block text-xs">
                      {formatDateHeure(a.date)}
                    </span>
                  </span>
                  <span
                    className={
                      a.annule ? "text-muted line-through" : "font-medium"
                    }
                  >
                    {formatFcfa(a.total)}
                    {a.annule && (
                      <span className="text-danger ml-2 text-xs font-bold uppercase no-underline">
                        Annulé
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
