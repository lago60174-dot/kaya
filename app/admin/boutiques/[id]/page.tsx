import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FormulairePaiement, FormulairePlan, FormulaireStatut } from "@/components/admin/formulaires";
import { COULEUR_STATUT, LIBELLE_ACTION, LIBELLE_STATUT, dateHeure, dateSeule } from "@/lib/admin";
import { LIBELLE_STATUT_FACTURE } from "@/lib/abonnement/abonnement";
import { formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { lireFiche } from "@/server/admin/lecture";

export const metadata = { title: "Boutique · Administration Kaya" };

const carte = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm";

export default async function PageFicheBoutique({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await supabaseServeur();
  const [f, plans] = await Promise.all([lireFiche(db, id), db.from("plans").select("code, nom").order("ordre")]);
  if (!f) notFound();
  const statut = f.abonnement?.statut ?? "";
  const infos: [string, string][] = [
    ["Propriétaire", [f.proprietaire?.nom, f.proprietaire?.email].filter(Boolean).join(" · ") || "—"],
    ["Boutique", [f.boutique?.nom, f.boutique?.ville].filter(Boolean).join(" · ") || "—"],
    ["Téléphone", f.boutique?.telephone ?? "—"],
    ["Inscrite le", dateSeule(f.creeLe)],
    ["Parrain", f.parrain ? `${f.parrain.nom} (${f.parrain.code})` : "—"],
    ["Vendeurs actifs", String(f.vendeurs)],
    ["Produits", String(f.produits)],
    ["Clients", String(f.clients)],
    ["Ventes (30 jours)", `${f.ventes30j.nb} · ${formatFcfa(f.ventes30j.total)}`],
    ["Dernière vente", dateHeure(f.derniereVente)],
  ];
  return (
    <>
      <Link href="/admin/boutiques" className="text-sm font-semibold underline">
        ← Toutes les boutiques
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{f.nom}</h1>
        <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${COULEUR_STATUT[statut] ?? ""}`}>{LIBELLE_STATUT[statut] ?? statut}</span>
        <span className="rounded-full bg-gray-100 px-3 py-0.5 text-sm font-bold capitalize">{f.plan}</span>
      </div>

      <section aria-label="Informations" className={carte}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {infos.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-muted text-xs">{k}</dt>
              <dd className="font-medium break-words">{v}</dd>
            </div>
          ))}
        </dl>
        {f.abonnement && (
          <p className="text-sm">
            Prochaine échéance : <b>{dateSeule(f.abonnement.prochaineEcheance)}</b>
            {f.abonnement.finGrace && <> · fin du délai de grâce : <b>{dateSeule(f.abonnement.finGrace)}</b></>}
            {f.abonnement.planEnAttente && <> · plan à venir : <b className="capitalize">{f.abonnement.planEnAttente}</b></>}
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Enregistrer un paiement" className={carte}>
          <h2 className="text-lg font-bold">Enregistrer un paiement reçu</h2>
          <p className="text-muted text-sm">Pour un transfert Mobile Money direct ou des espèces. L&apos;abonnement est prolongé aussitôt.</p>
          <FormulairePaiement org={f.id} />
        </section>
        <div className="flex flex-col gap-5">
          <section aria-label="Changer de plan" className={carte}>
            <h2 className="text-lg font-bold">Plan</h2>
            <p className="text-muted text-sm">Une montée de plan est immédiate ; une descente prend effet à la fin de la période payée.</p>
            <FormulairePlan org={f.id} plans={plans.data ?? []} actuel={f.plan} />
          </section>
          <section aria-label="Statut" className={carte}>
            <h2 className="text-lg font-bold">Statut de l&apos;abonnement</h2>
            <p className="text-muted text-sm">Suspendre met la boutique en lecture seule, sans rien supprimer.</p>
            <FormulaireStatut org={f.id} statut={statut} />
          </section>
        </div>
      </div>

      <section aria-label="Factures" className={carte}>
        <h2 className="text-lg font-bold">Factures</h2>
        {f.factures.length === 0 ? (
          <p className="text-muted">Aucune facture.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {f.factures.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="flex flex-col">
                  <b>
                    {x.type === "installation" ? "Installation" : `Abonnement ${x.moisCouverts} mois`} · {formatFcfa(x.montantBrut)}
                  </b>
                  <span className="text-muted">
                    {LIBELLE_STATUT_FACTURE[x.statut] ?? x.statut} · {x.mode === "manuel" ? "manuel" : "Fapshi"}
                    {x.payeeLe ? ` · payée le ${dateSeule(x.payeeLe)}` : x.echeance ? ` · échéance ${dateSeule(x.echeance)}` : ""}
                    {x.note ? ` · ${x.note}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Historique" className={carte}>
        <h2 className="text-lg font-bold">Historique des actions</h2>
        {f.journal.length === 0 ? (
          <p className="text-muted">Aucune action enregistrée.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {f.journal.map((j, i) => (
              <li key={i}>
                <b>{LIBELLE_ACTION[j.action] ?? j.action}</b> <span className="text-muted">· {dateHeure(j.creeLe)}</span>
                {typeof j.details.note === "string" && j.details.note && <span> · {j.details.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
