import { ChoixPlan } from "@/components/abonnement/choix-plan";
import {
  bandeauAbonnement,
  etatDepuisSql,
  LIBELLE_STATUT,
} from "@/lib/abonnement/etat";
import { formatFcfa } from "@/lib/format";
import { planDepuisLigne } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { payerMaintenantAction } from "@/server/abonnement/actions";

const date = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Africa/Douala",
  }).format(d);

/** « Mon abonnement » : état, échéance, choix du plan et paiement. Lisible même en lecture seule (suspendu). */
export async function SectionAbonnement({ planCode }: { planCode: string }) {
  const supabase = await supabaseServeur();
  const [{ data: brut }, { data: lignes }] = await Promise.all([
    supabase.rpc("abonnement_statut"),
    supabase.from("plans").select("*").order("ordre"),
  ]);
  const etat = etatDepuisSql(brut);
  if (!etat) return null;
  const plans = (lignes ?? []).map(planDepuisLigne);
  const actuel = plans.find((p) => p.code === planCode);
  const bandeau = bandeauAbonnement(etat, new Date());
  const choisi = etat.planEnAttente ?? planCode;
  const prochain = plans.find((p) => p.code === choisi) ?? actuel;
  const echeance = etat.echeance;

  return (
    <section id="abonnement" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Mon abonnement</h2>
      {bandeau && (
        <p
          role={bandeau.ton === "info" ? "status" : "alert"}
          className="bg-brand-soft rounded-lg p-3 text-sm"
        >
          {bandeau.message}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">État</dt>
        <dd className="font-medium">{LIBELLE_STATUT[etat.statut]}</dd>
        <dt className="text-muted">Plan actuel</dt>
        <dd className="font-medium">{actuel?.nom ?? planCode}</dd>
        {echeance && (
          <>
            <dt className="text-muted">
              {etat.statut === "en_attente"
                ? "À régler avant le"
                : "Prochaine échéance"}
            </dt>
            <dd className="font-medium">{date(echeance)}</dd>
          </>
        )}
        {etat.planEnAttente && (
          <>
            <dt className="text-muted">Prochain plan</dt>
            <dd className="font-medium">{prochain?.nom}</dd>
          </>
        )}
      </dl>
      <ChoixPlan
        options={plans
          .filter((p) => p.visiblePublic || p.code === planCode)
          .map((p) => ({
            code: p.code,
            nom: p.nom,
            prix: formatFcfa(p.prixMensuel),
          }))}
        choisi={choisi}
      />
      {etat.statut !== "annule" && (
        <form action={payerMaintenantAction}>
          <button
            type="submit"
            className="bg-brand min-h-12 w-full rounded-lg px-4 font-semibold text-white"
          >
            Payer mon abonnement
            {prochain ? ` · ${formatFcfa(prochain.prixMensuel)}` : ""}
          </button>
        </form>
      )}
      <p className="text-muted text-xs">
        Paiement par Mobile Money. Pour un abonnement annuel (2 mois offerts) ou
        les frais d&apos;installation, contactez-nous.
      </p>
    </section>
  );
}
