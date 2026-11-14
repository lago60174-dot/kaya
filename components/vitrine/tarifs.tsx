import Link from "next/link";
import { formatFcfa } from "@/lib/format";
import type { Plan } from "@/lib/plans";
import { lignesDuPlan } from "@/lib/vitrine/offre";
import { boutonOrange } from "./boutons";

const conteneur = "mx-auto w-full max-w-6xl px-5 sm:px-8";

/** Affiche uniquement les plans visibles reçus de la base. Aucun prix n'est écrit dans ce fichier. */
export function Tarifs({
  plans,
  lienWhatsApp,
}: {
  plans: Plan[];
  lienWhatsApp: string | null;
}) {
  return (
    <section id="tarifs" className="bg-beton py-16 lg:py-24">
      <div className={conteneur}>
        <h2 className="font-affiche max-w-[16ch] text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[0.92]">
          Un prix clair, payé par Mobile Money.
        </h2>
        {plans.length === 0 ? (
          <p className="mt-8 max-w-[50ch] text-lg">
            {lienWhatsApp ? (
              <>
                Écrivez-nous sur{" "}
                <a
                  href={lienWhatsApp}
                  className="text-brand-strong font-bold underline underline-offset-4"
                >
                  WhatsApp
                </a>{" "}
                pour connaître le prix.
              </>
            ) : (
              "Le prix n'est pas disponible pour le moment. Revenez dans quelques minutes."
            )}
          </p>
        ) : (
          <div
            className={`mt-10 grid gap-8 ${
              plans.length > 1 ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-lg"
            }`}
          >
            {plans.map((plan) => (
              <article
                key={plan.code}
                className="border-goudron flex flex-col gap-5 border-[3px] bg-white p-6 shadow-[0.5rem_0.5rem_0_var(--goudron)] sm:p-8"
              >
                <h3 className="font-affiche text-4xl leading-none">
                  {plan.nom}
                </h3>
                <p>
                  <span className="font-affiche text-7xl leading-none">
                    {formatFcfa(plan.prixMensuel)}
                  </span>{" "}
                  <span className="text-lg font-bold">par mois</span>
                </p>
                <p className="text-terre">
                  Paiement par MTN Mobile Money ou Orange Money. Pas de
                  prélèvement automatique, pas d&apos;engagement.
                </p>
                <ul className="border-goudron/30 flex flex-col gap-2 border-t-2 pt-4">
                  <li>Stock, ventes, crédits clients et caisse</li>
                  <li>Reçus numérotés à partager sur WhatsApp</li>
                  <li>Suivi en direct depuis votre téléphone</li>
                  {lignesDuPlan(plan).map((ligne) => (
                    <li key={ligne}>{ligne}</li>
                  ))}
                </ul>
                <Link href="/inscription" className={`${boutonOrange} mt-2`}>
                  Créer ma boutique
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
