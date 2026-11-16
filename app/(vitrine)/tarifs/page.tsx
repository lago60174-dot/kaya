import type { Metadata } from "next";
import Link from "next/link";
import { Bientot, CartesPlans } from "@/components/vitrine/tarifs";
import { boutonOrange } from "@/components/vitrine/boutons";
import { formatFcfa } from "@/lib/format";
import {
  comparatif,
  INCLUS_PARTOUT,
  prixAnnuel,
} from "@/lib/vitrine/comparatif";
import { donneesStructurees, jsonPourScript } from "@/lib/vitrine/offre";
import { lienContact } from "@/lib/vitrine/site";
import { chargerOffrePublique } from "@/server/vitrine/offre-publique";

export const revalidate = 60;

const DESCRIPTION =
  "Les tarifs de Kaya pour quincaillerie au Cameroun : trois formules à payer par MTN Mobile Money ou Orange Money, sans engagement. Comparez ce que chacune inclut.";

export const metadata: Metadata = {
  title: "Tarifs",
  description: DESCRIPTION,
  alternates: { canonical: "/tarifs" },
  openGraph: { title: "Tarifs · Kaya", description: DESCRIPTION, url: "/tarifs" },
};

const conteneur = "mx-auto w-full max-w-6xl px-5 sm:px-8";

const ETAPES = [
  ["Créez votre boutique", "L'inscription prend quelques minutes : nom, ville, téléphone, mot de passe. Vous choisissez votre formule."],
  ["Payez par Mobile Money", "Depuis l'application ou le lien reçu sur WhatsApp, vous réglez avec MTN Mobile Money ou Orange Money."],
  ["3 jours de grâce", "Si le paiement est en retard, vous gardez 3 jours pour régler sans rien perdre. Kaya vous rappelle sur WhatsApp."],
  ["Lecture seule, jamais de perte", "Sans paiement après la grâce, le compte passe en lecture seule : vous consultez tout, vos données restent conservées. Réglez, et tout rouvre."],
] as const;

const QUESTIONS = [
  ["Comment je paie ?", "Par MTN Mobile Money ou Orange Money, depuis un lien de paiement. Il n'y a pas de prélèvement automatique : vous payez chaque mois quand vous le décidez."],
  ["Y a-t-il un engagement ?", "Non. Vous arrêtez quand vous voulez. Votre compte passe en lecture seule et vos données ne sont pas supprimées."],
  ["Puis-je changer de formule ?", "Oui, depuis les paramètres de l'application. La nouvelle formule s'applique au paiement suivant, et la facture est recalculée à son prix."],
  ["Que veut dire « Bientôt disponible » ?", "Ces fonctions font partie de la formule mais ne sont pas encore livrées. Elles s'ajouteront à votre compte dès qu'elles sont prêtes, sans supplément."],
  ["Mon vendeur coûte-t-il en plus ?", "Non. Le nombre de vendeurs est compris dans chaque formule, dans la limite indiquée dans le tableau."],
  ["Faut-il une imprimante ?", "Non. Le reçu part en PDF sur WhatsApp. Les formules Pro et Business permettent en plus d'imprimer sur un ticket de 58 mm ou en A4."],
] as const;

export default async function PageTarifs() {
  const { plans } = await chargerOffrePublique();
  const lienWhatsApp = lienContact();
  const lignes = comparatif(plans);
  return (
    <main id="contenu">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonPourScript(donneesStructurees(plans, DESCRIPTION)),
        }}
      />
      <section className="bg-[#fffaf6] py-12 lg:py-16">
        <div className={conteneur}>
          <h1 className="text-center text-4xl font-bold text-[var(--nuit)] sm:text-5xl">
            Des tarifs simples, pour une quincaillerie qui compte.
          </h1>
          <p className="mx-auto mt-4 max-w-[60ch] text-center text-lg">
            Trois formules, un prix par mois, payé par Mobile Money. Pas
            d&apos;engagement, pas de prélèvement automatique.
          </p>
          <div className="mt-10">
            {plans.length === 0 ? (
              <p className="text-center text-lg">
                Les tarifs ne sont pas disponibles pour le moment. Revenez dans
                quelques minutes
                {lienWhatsApp && (
                  <>
                    {" "}
                    ou écrivez-nous sur{" "}
                    <a href={lienWhatsApp} className="text-brand-strong font-bold underline underline-offset-4">
                      WhatsApp
                    </a>
                  </>
                )}
                .
              </p>
            ) : (
              <CartesPlans plans={plans} />
            )}
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="bg-white py-12 lg:py-16" aria-labelledby="comparer">
          <div className={conteneur}>
            <h2 id="comparer" className="text-3xl font-bold text-[var(--nuit)]">
              Comparer les formules
            </h2>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-[#f3dcc3]">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#fff0e2]">
                    <th scope="col" className="p-4 font-bold">
                      <span className="sr-only">Fonction</span>
                    </th>
                    {plans.map((p) => (
                      <th key={p.code} scope="col" className="p-4">
                        <span className="block text-xl font-bold">{p.nom}</span>
                        <span className="font-bold text-[var(--kaya)]">
                          {formatFcfa(p.prixMensuel)} / mois
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.libelle} className="border-t border-[#f3dcc3]">
                      <th scope="row" className="p-4 font-semibold">
                        {l.libelle}
                      </th>
                      {plans.map((p) => {
                        const v = l.valeurs[p.code];
                        return (
                          <td key={p.code} className="p-4">
                            {v.bientot ? (
                              <>
                                {v.texte === "Bientôt disponible" ? null : v.texte}
                                <Bientot />
                              </>
                            ) : v.oui ? (
                              <span className="font-bold text-[var(--kaya)]">✓ {v.texte}</span>
                            ) : (
                              <span className="text-[#8a7b6d]">{v.texte}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#fffaf6] py-12 lg:py-16" aria-labelledby="inclus">
        <div className={conteneur}>
          <h2 id="inclus" className="text-3xl font-bold text-[var(--nuit)]">
            Inclus dans toutes les formules
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUS_PARTOUT.map((i) => (
              <li key={i.titre} className="rounded-2xl border border-[#f3dcc3] bg-white p-5">
                <h3 className="text-lg font-bold">{i.titre}</h3>
                <p className="mt-1.5">{i.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white py-12 lg:py-16" aria-labelledby="paiement">
        <div className={conteneur}>
          <h2 id="paiement" className="text-3xl font-bold text-[var(--nuit)]">
            Comment se passe le paiement
          </h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES.map(([titre, texte], i) => (
              <li key={titre} className="rounded-2xl border border-[#f3dcc3] p-5">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--kaya)] font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold">{titre}</h3>
                <p className="mt-1.5">{texte}</p>
              </li>
            ))}
          </ol>
          {plans.length > 0 && (
            <div className="mt-8 rounded-2xl bg-[#fff0e2] p-6">
              <h3 className="text-xl font-bold">Payer à l&apos;année : 2 mois offerts</h3>
              <p className="mt-2">
                En payant 12 mois d&apos;un coup, vous ne réglez que 10 mois :{" "}
                {plans.map((p, i) => (
                  <span key={p.code}>
                    {i > 0 && (i === plans.length - 1 ? " et " : ", ")}
                    {p.nom} {prixAnnuel(p)}
                  </span>
                ))}
                . Ce paiement se règle avec notre équipe
                {lienWhatsApp ? (
                  <>
                    {" "}
                    <a href={lienWhatsApp} className="text-brand-strong font-bold underline underline-offset-4">
                      sur WhatsApp
                    </a>
                  </>
                ) : null}
                .
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-[#fffaf6] py-12 lg:py-16" aria-labelledby="questions">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <h2 id="questions" className="text-3xl font-bold text-[var(--nuit)]">
            Questions sur les tarifs
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {QUESTIONS.map(([q, r]) => (
              <details key={q} className="rounded-2xl border border-[#f3dcc3] bg-white p-5">
                <summary className="min-h-11 cursor-pointer text-lg font-bold">{q}</summary>
                <p className="mt-2">{r}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/inscription" className={boutonOrange}>
              Créer ma boutique
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
