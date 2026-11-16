import Link from "next/link";
import { formatFcfa } from "@/lib/format";
import type { Plan } from "@/lib/plans";
import { lignesPlan } from "@/lib/vitrine/comparatif";
import { boutonContour, boutonOrange } from "./boutons";

const conteneur = "mx-auto w-full max-w-6xl px-5 sm:px-8";

/** Mention des fonctions annoncées mais pas encore livrées. */
export function Bientot() {
  return (
    <span className="ml-2 inline-block rounded-full bg-[#fff0e2] px-2.5 py-0.5 align-middle text-xs font-bold text-[var(--kaya)]">
      Bientôt disponible
    </span>
  );
}

/** Les plans reçus de la base, côte à côte. Aucun prix n'est écrit dans ce fichier. */
export function CartesPlans({ plans }: { plans: Plan[] }) {
  return (
    <div
      className={`grid gap-8 ${
        plans.length > 1 ? "md:grid-cols-2 lg:grid-cols-3" : "mx-auto max-w-lg"
      }`}
    >
      {plans.map((plan, i) => (
        <article
          key={plan.code}
          className={`flex flex-col gap-5 rounded-2xl border bg-white p-6 shadow-[0_12px_34px_rgba(42,34,25,0.08)] sm:p-8 ${
            i === 1 && plans.length === 3 ? "border-[var(--kaya)] border-2" : "border-[#f3dcc3]"
          }`}
        >
          <h3 className="text-2xl font-bold">{plan.nom}</h3>
          <p>
            <span className="text-5xl font-bold text-[var(--kaya)]">
              {formatFcfa(plan.prixMensuel)}
            </span>{" "}
            <span className="text-lg font-bold">par mois</span>
          </p>
          <p className="text-terre">
            Paiement par MTN Mobile Money ou Orange Money. Pas de prélèvement
            automatique, pas d&apos;engagement.
          </p>
          <ul className="flex flex-col gap-2 border-t border-[#f3dcc3] pt-4">
            <li>Stock, ventes, crédits clients et caisse</li>
            <li>Reçus numérotés à partager sur WhatsApp</li>
            <li>Tableau de bord et rapports depuis votre téléphone</li>
            {lignesPlan(plan).map((l) => (
              <li key={l.texte}>
                {l.texte}
                {l.bientot && <Bientot />}
              </li>
            ))}
          </ul>
          <Link
            href={`/inscription?plan=${plan.code}`}
            className={`${i === 1 && plans.length === 3 ? boutonOrange : boutonContour} mt-auto`}
          >
            Choisir {plan.nom}
          </Link>
        </article>
      ))}
    </div>
  );
}

export function Tarifs({
  plans,
  lienWhatsApp,
}: {
  plans: Plan[];
  lienWhatsApp: string | null;
}) {
  return (
    <section id="tarifs" className="bg-[#fffaf6] py-12 lg:py-16">
      <div className={conteneur}>
        <h2 className="text-center text-3xl font-bold text-[var(--nuit)] sm:text-4xl">
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
          <>
            <div className="mt-10">
              <CartesPlans plans={plans} />
            </div>
            <p className="mt-8 text-center">
              <Link
                href="/tarifs"
                className="text-brand-strong font-bold underline underline-offset-4"
              >
                Voir le détail des tarifs et comparer les formules
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
