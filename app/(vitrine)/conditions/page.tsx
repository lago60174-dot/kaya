import type { Metadata } from "next";
import Link from "next/link";
import {
  lienTexte,
  PageTexte,
  Rubrique,
} from "@/components/vitrine/page-texte";
import { MISE_A_JOUR_LEGALE } from "@/lib/vitrine/editeur";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Les règles d'utilisation de Kaya, le paiement et la fin d'abonnement.",
  alternates: { canonical: "/conditions" },
};

export default function Conditions() {
  return (
    <PageTexte titre="Conditions d'utilisation" miseAJour={MISE_A_JOUR_LEGALE}>
      <p>
        En créant un compte Kaya, vous acceptez ces conditions. Elles sont
        écrites pour être lues.
      </p>
      <Rubrique titre="Le service">
        <p>
          Kaya est une application de gestion pour les quincailleries : stock,
          ventes, crédits clients, caisse et reçus. Elle s&apos;utilise depuis
          un téléphone ou un ordinateur connecté à internet.
        </p>
      </Rubrique>
      <Rubrique titre="Votre compte">
        <p>
          Vous êtes responsable de votre compte et de ceux de vos vendeurs.
          Gardez vos mots de passe secrets et désactivez le compte d&apos;un
          vendeur qui quitte votre boutique. Les informations données à
          l&apos;inscription doivent être exactes.
        </p>
      </Rubrique>
      <Rubrique titre="Prix et paiement">
        <p>
          L&apos;abonnement se paie chaque mois par MTN Mobile Money ou Orange
          Money. Le prix en vigueur est affiché sur la{" "}
          <Link href="/#tarifs" className={lienTexte}>
            page des tarifs
          </Link>
          . Il n&apos;y a pas de prélèvement automatique. Les paiements déjà
          faits ne sont pas remboursés, sauf erreur de notre part.
        </p>
      </Rubrique>
      <Rubrique titre="Si vous arrêtez de payer">
        <p>
          Après un délai de grâce, votre compte passe en lecture seule : vous
          pouvez consulter vos données mais plus en ajouter. Vos données ne sont
          pas supprimées. Le paiement de l&apos;abonnement réactive le compte
          aussitôt.
        </p>
      </Rubrique>
      <Rubrique titre="Ce que vous vous engagez à ne pas faire">
        <ul className="list-disc space-y-2 pl-6">
          <li>Utiliser Kaya pour une activité illégale.</li>
          <li>
            Essayer d&apos;accéder aux données d&apos;une autre boutique ou de
            contourner les limites de votre abonnement.
          </li>
          <li>Perturber le service ou tenter de le copier.</li>
        </ul>
      </Rubrique>
      <Rubrique titre="Vos données">
        <p>
          Les données de votre boutique vous appartiennent. Nous les traitons
          comme décrit dans la{" "}
          <Link href="/confidentialite" className={lienTexte}>
            politique de confidentialité
          </Link>
          . Vous êtes responsable de l&apos;exactitude de ce que vous saisissez
          et de vos obligations comptables et fiscales : Kaya vous aide à tenir
          vos comptes mais ne remplace pas un comptable.
        </p>
      </Rubrique>
      <Rubrique titre="Disponibilité et responsabilité">
        <p>
          Nous faisons le maximum pour que Kaya fonctionne en permanence, sans
          pouvoir promettre qu&apos;il ne sera jamais interrompu. Notre
          responsabilité est limitée aux dommages directs et ne peut dépasser
          les sommes que vous avez payées pour votre abonnement.
        </p>
      </Rubrique>
      <Rubrique titre="Changements et droit applicable">
        <p>
          Nous pouvons modifier ces conditions. Si le changement vous concerne,
          nous vous prévenons à l&apos;avance dans l&apos;application. Ces
          conditions sont soumises au droit camerounais.
        </p>
      </Rubrique>
    </PageTexte>
  );
}
