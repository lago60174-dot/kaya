import type { Metadata } from "next";
import Link from "next/link";
import { FormulairePartenaire } from "@/components/vitrine/formulaire-partenaire";
import { lienTexte } from "@/components/vitrine/page-texte";
import { exempleCommission } from "@/lib/affiliation/exemple";
import { formatFcfa } from "@/lib/format";
import { chargerOffrePublique } from "@/server/vitrine/offre-publique";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Devenir partenaire Kaya",
  description:
    "Parrainez des quincailleries au Cameroun et touchez une commission sur chaque abonnement payé.",
  alternates: { canonical: "/partenaire" },
};

const ETAPES = [
  [
    "Vous nous envoyez votre demande.",
    "Votre nom, votre numéro WhatsApp et le Mobile Money où recevoir vos commissions.",
  ],
  [
    "Vous recevez votre lien personnel.",
    "Après validation, vous partagez votre lien ou votre code avec les quincailleries que vous connaissez.",
  ],
  [
    "Vous êtes payé chaque mois.",
    "Quand une quincaillerie parrainée paie son abonnement, une commission est ajoutée à votre compte.",
  ],
];

export default async function Partenaire() {
  const { plans, programme } = await chargerOffrePublique();
  const plan = plans[0];
  const exemple =
    plan && programme
      ? exempleCommission(plan.prixMensuel, programme.commissionPourcentage)
      : null;

  return (
    <main id="contenu">
      <section className="bg-goudron sur-sombre text-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
          <h1 className="font-affiche max-w-[14ch] text-[clamp(3.25rem,9vw,7rem)] leading-[0.88]">
            Faites connaître Kaya. Soyez payé.
          </h1>
          <p className="text-beton mt-6 max-w-[44ch] text-xl">
            Vous connaissez des quincailleries ? Parrainez-les : vous touchez
            une commission sur chaque abonnement qu&apos;elles paient.
          </p>
          <a
            href="#demande"
            className="bg-brand text-goudron mt-8 inline-flex min-h-12 items-center px-6 text-lg font-bold"
          >
            Envoyer ma demande
          </a>
        </div>
      </section>

      {exemple && programme && (
        <section className="bg-brand tole text-goudron">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
            <h2 className="font-affiche max-w-[18ch] text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.92]">
              Un exemple avec un abonnement {plan.nom}.
            </h2>
            <dl className="mt-8 grid max-w-2xl grid-cols-[1fr_auto] gap-x-8 gap-y-3 text-xl">
              <dt>La quincaillerie paie</dt>
              <dd className="text-right font-bold">
                {formatFcfa(exemple.brut)}
              </dd>
              <dt>Frais de paiement retirés</dt>
              <dd className="text-right font-bold">
                {formatFcfa(-exemple.frais)}
              </dd>
              <dt>Montant net encaissé</dt>
              <dd className="text-right font-bold">
                {formatFcfa(exemple.net)}
              </dd>
              <dt className="border-goudron border-t-2 pt-3 text-2xl font-bold">
                Votre commission de {programme.commissionPourcentage} %
              </dt>
              <dd className="font-affiche border-goudron border-t-2 pt-3 text-right text-5xl leading-none">
                {formatFcfa(exemple.commission)}
              </dd>
            </dl>
            <p className="mt-6 max-w-[52ch] text-lg font-medium">
              Vous touchez cette commission à chaque paiement pendant{" "}
              {programme.dureeMois} mois, soit{" "}
              {formatFcfa(exemple.commission * programme.dureeMois)} pour une
              quincaillerie qui paie tous ses mois. Après {programme.dureeMois}{" "}
              mois, la commission s&apos;arrête.
            </p>
          </div>
        </section>
      )}

      <section className="bg-white py-14 lg:py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <h2 className="font-affiche max-w-[16ch] text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.92]">
            Comment ça marche.
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {ETAPES.map(([titre, texte], i) => (
              <li key={titre} className="flex flex-col gap-3">
                <span
                  aria-hidden="true"
                  className="font-affiche text-brand-strong text-8xl leading-none"
                >
                  {i + 1}
                </span>
                <h3 className="font-affiche text-4xl leading-none">{titre}</h3>
                <p className="text-terre">{texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="demande" className="bg-beton py-14 lg:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-affiche max-w-[12ch] text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.92]">
              Devenir partenaire.
            </h2>
            <p className="text-terre mt-5 max-w-[44ch]">
              Nous étudions chaque demande à la main et nous vous répondons sur
              WhatsApp. Les règles complètes sont dans les{" "}
              <Link href="/conditions-partenaires" className={lienTexte}>
                conditions du programme
              </Link>
              .
            </p>
          </div>
          <div className="bg-white p-6 sm:p-8">
            <FormulairePartenaire />
          </div>
        </div>
      </section>
    </main>
  );
}
