import { Banknote, Check, Phone, ShoppingCart, Wallet } from "lucide-react";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const profil = await exigerRole("boutique");
  const { id } = await params;
  const demande = (await searchParams).onglet;
  const onglet = demande === "details" || demande === "notes" ? demande : "historique";
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold">{client.nom}</h1>
            {fiche.achats.length >= 5 && (
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">★ Client fidèle</span>
            )}
          </div>
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
          <p className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#fdeee3" }}>
            <Wallet aria-hidden="true" size={30} className="shrink-0 text-orange-600" />
            <span>
              <span className="block text-sm font-bold text-red-700">Crédit dû</span>
              <b className={`block text-xl font-extrabold ${dette > 0 ? "text-red-700" : ""}`}>
                {formatFcfa(dette)}
              </b>
            </span>
          </p>
          <p className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#e4edff" }}>
            <Banknote aria-hidden="true" size={30} className="shrink-0 text-blue-700" />
            <span>
              <span className="block text-sm font-bold text-blue-800">Encore disponible</span>
              <b className="block text-xl font-extrabold">
                {formatFcfa(Math.max(0, plafond - dette))}
              </b>
            </span>
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
          <section aria-label="Dettes en cours" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Dettes en cours</h2>
            <ul className="flex flex-col">
              {fiche.creances.map((c) => (
                <li
                  key={c.id}
                  className="border-border flex items-center gap-3 border-b py-3 text-sm last:border-0"
                >
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ShoppingCart size={20} />
                  </span>
                  <span className="flex-1 font-bold">
                    {c.numeroRecu}
                    <span className="text-muted block text-xs">
                      {formatDateHeure(c.date)}
                    </span>
                  </span>
                  <span className="font-extrabold">{formatFcfa(c.solde)}</span>
                </li>
              ))}
            </ul>
          </section>
          <p
            className="flex items-center justify-center gap-3 rounded-2xl p-4"
            style={{ background: "#dff4e7" }}
          >
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-emerald-600 text-white">
              <Check size={22} strokeWidth={3} />
            </span>
            <span>
              <span className="block text-sm font-bold">Solde actuel</span>
              <b className="block text-xl font-extrabold">{formatFcfa(dette)}</b>
            </span>
          </p>
          <FormulairePaiement
            clientId={client.id}
            creances={fiche.creances}
            dette={dette}
          />
        </>
      )}

      <nav aria-label="Sections de la fiche" className="flex gap-2">
        {([["historique", "Historique"], ["details", "Détails"], ["notes", "Notes"]] as const).map(([code, libelle]) => (
          <Link
            key={code}
            href={`/clients/${client.id}?onglet=${code}`}
            aria-current={code === onglet ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-bold ${code === onglet ? "bg-orange-500 text-white" : "bg-white shadow-sm"}`}
          >
            {libelle}
          </Link>
        ))}
      </nav>
      {onglet === "historique" && (
        <>
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
        </>
      )}
      {onglet === "details" && (
        <section aria-label="Détails" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Détails</h2>
          <dl className="flex flex-col text-sm">
            <div className="border-border flex justify-between gap-3 border-b py-2"><dt className="text-muted">Téléphone</dt><dd className="font-medium">{client.telephone ?? "—"}</dd></div>
            <div className="border-border flex justify-between gap-3 border-b py-2"><dt className="text-muted">Plafond de crédit</dt><dd className="font-medium">{formatFcfa(plafond)}</dd></div>
            <div className="border-border flex justify-between gap-3 border-b py-2"><dt className="text-muted">Crédit dû</dt><dd className="font-medium">{formatFcfa(dette)}</dd></div>
          </dl>
        </section>
      )}
      {onglet === "notes" && (
        <section aria-label="Notes" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Notes</h2>
          <p>{client.notes || "Aucune note pour ce client."}</p>
        </section>
      )}
    </div>
  );
}
