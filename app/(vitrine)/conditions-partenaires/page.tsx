import type { Metadata } from "next";
import Link from "next/link";
import {
  lienTexte,
  PageTexte,
  Rubrique,
} from "@/components/vitrine/page-texte";
import { DUREE_COOKIE_PARRAINAGE_SECONDES } from "@/lib/auth/parrainage";
import { formatFcfa } from "@/lib/format";
import { MISE_A_JOUR_LEGALE } from "@/lib/vitrine/editeur";
import { chargerOffrePublique } from "@/server/vitrine/offre-publique";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conditions du programme partenaire",
  description:
    "Les règles du programme partenaire Kaya : commissions, versements et interdictions.",
  alternates: { canonical: "/conditions-partenaires" },
};

export default async function ConditionsPartenaires() {
  const { programme } = await chargerOffrePublique();
  const joursCookie = Math.round(DUREE_COOKIE_PARRAINAGE_SECONDES / 86400);
  return (
    <PageTexte
      titre="Conditions du programme partenaire"
      miseAJour={MISE_A_JOUR_LEGALE}
    >
      <p>
        Le programme partenaire récompense les personnes qui font connaître Kaya
        aux quincailleries. Pour le présenter, voir la page{" "}
        <Link href="/partenaire" className={lienTexte}>
          Devenir partenaire
        </Link>
        .
      </p>
      <Rubrique titre="Devenir partenaire">
        <p>
          Chaque demande est étudiée à la main. Un lien de parrainage n&apos;est
          actif qu&apos;après notre réponse, et nous pouvons refuser une
          demande.
        </p>
      </Rubrique>
      <Rubrique titre="La commission">
        <p>
          {programme
            ? `Vous touchez ${programme.commissionPourcentage} % de chaque paiement d'abonnement encaissé pendant les ${programme.dureeMois} premiers mois d'abonnement payant de la quincaillerie que vous avez parrainée.`
            : "Vous touchez un pourcentage de chaque paiement d'abonnement encaissé pendant les premiers mois d'abonnement payant de la quincaillerie que vous avez parrainée."}{" "}
          La commission se calcule sur le montant net, une fois les frais de
          paiement retirés. Les frais d&apos;installation n&apos;en donnent pas.
          Une commission n&apos;existe qu&apos;après un paiement confirmé.
        </p>
      </Rubrique>
      <Rubrique titre="Quand la commission est payée">
        <p>
          {programme
            ? `Une commission reste en attente ${programme.retentionJours} jours, le temps de vérifier qu'il n'y a ni remboursement ni litige. Elle devient ensuite payable. Les versements se font une fois par mois, par Mobile Money, à partir de ${formatFcfa(programme.seuilVersement)}.`
            : "Une commission reste en attente quelques jours, le temps de vérifier qu'il n'y a ni remboursement ni litige. Elle devient ensuite payable. Les versements se font une fois par mois, par Mobile Money, au-delà d'un montant minimum."}{" "}
          Elle est annulée en cas de remboursement, de litige ou de fraude.
        </p>
      </Rubrique>
      <Rubrique titre="À qui revient le parrainage">
        <p>
          Le parrainage revient à la première personne dont le lien ou le code a
          été utilisé : il est fixé à l&apos;inscription et ne change plus. Le
          lien garde la trace pendant {joursCookie} jours.
        </p>
      </Rubrique>
      <Rubrique titre="Ce qui est interdit">
        <ul className="list-disc space-y-2 pl-6">
          <li>Envoyer des messages non désirés en masse (spam).</li>
          <li>
            Faire de fausses promesses sur Kaya, ses prix ou ses résultats.
          </li>
          <li>
            Vous parrainer vous-même : même téléphone, même email ou même
            boutique que votre propre compte.
          </li>
          <li>Créer de faux comptes pour gagner des commissions.</li>
        </ul>
        <p>
          En cas de fraude, les commissions sont suspendues ou annulées et le
          compte partenaire peut être fermé.
        </p>
      </Rubrique>
      <Rubrique titre="Vos impôts">
        <p>
          Vous êtes responsable de déclarer vos commissions selon la règle
          fiscale qui s&apos;applique à vous.
        </p>
      </Rubrique>
      <Rubrique titre="Changements">
        <p>
          Nous pouvons modifier ces conditions et les taux de commission. Nous
          vous prévenons à l&apos;avance, et les commissions déjà acquises ne
          changent pas.
        </p>
      </Rubrique>
    </PageTexte>
  );
}
