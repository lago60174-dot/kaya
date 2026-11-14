import type { Metadata } from "next";
import {
  lienTexte,
  PageTexte,
  Rubrique,
} from "@/components/vitrine/page-texte";
import { DUREE_COOKIE_PARRAINAGE_SECONDES } from "@/lib/auth/parrainage";
import { MISE_A_JOUR_LEGALE } from "@/lib/vitrine/editeur";
import { lienContact } from "@/lib/vitrine/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Quelles données Kaya garde, pourquoi, et comment les faire corriger ou effacer.",
  alternates: { canonical: "/confidentialite" },
};

const JOURS_COOKIE = Math.round(DUREE_COOKIE_PARRAINAGE_SECONDES / 86400);

export default function Confidentialite() {
  const lien = lienContact(
    "Bonjour, j'ai une question sur mes données dans Kaya.",
  );
  return (
    <PageTexte
      titre="Politique de confidentialité"
      miseAJour={MISE_A_JOUR_LEGALE}
    >
      <p>
        Kaya garde le strict nécessaire pour faire fonctionner votre boutique.
        Nous ne vendons pas vos données.
      </p>
      <Rubrique titre="Ce que nous gardons">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Votre compte :</strong> le nom de votre boutique, votre
            ville, votre numéro WhatsApp, votre email et votre mot de passe (que
            nous ne pouvons pas lire).
          </li>
          <li>
            <strong>Votre boutique :</strong> vos produits, votre stock, vos
            ventes, vos dépenses, vos clients (nom et téléphone) et leurs
            crédits, ainsi qu&apos;un journal de ce qui a été fait et par qui.
          </li>
          <li>
            <strong>Les partenaires :</strong> le nom, le numéro WhatsApp et le
            mode de versement donnés dans le formulaire « Devenir partenaire ».
          </li>
        </ul>
      </Rubrique>
      <Rubrique titre="Pourquoi">
        <p>
          Pour tenir votre stock et vos comptes, vous montrer vos chiffres,
          gérer votre abonnement, vous aider quand vous nous écrivez, et verser
          les commissions de nos partenaires. Nous n&apos;utilisons pas vos
          données pour de la publicité.
        </p>
      </Rubrique>
      <Rubrique titre="Cookies">
        <p>
          Quand vous arrivez par le lien d&apos;un partenaire, Kaya garde le
          code de ce partenaire pendant {JOURS_COOKIE} jours pour lui attribuer
          votre inscription. Votre session de connexion utilise aussi un cookie.
        </p>
      </Rubrique>
      <Rubrique titre="Messages WhatsApp">
        <p>
          Les reçus et les rappels aux clients sont envoyés depuis le WhatsApp
          du vendeur, jamais par Kaya. Kaya n&apos;envoie un message à un patron
          (résumé de la journée, rappel d&apos;abonnement) qu&apos;avec son
          accord, et il peut l&apos;arrêter à tout moment.
        </p>
      </Rubrique>
      <Rubrique titre="Qui peut voir vos données">
        <p>
          Chaque boutique ne voit que ses données. Vos vendeurs ne voient jamais
          vos prix d&apos;achat ni vos marges. L&apos;équipe de Kaya ne regarde
          les ventes d&apos;une boutique qu&apos;avec votre accord, en lecture
          seule, et chaque ouverture est notée. Nos prestataires techniques
          (hébergement, base de données, paiement) traitent les données pour
          notre compte.
        </p>
      </Rubrique>
      <Rubrique titre="Combien de temps">
        <p>
          Nous gardons vos données tant que votre compte existe. Si vous arrêtez
          de payer, votre compte passe en lecture seule et vos données ne sont
          pas supprimées. Les reçus et le journal ne peuvent pas être effacés,
          car ils servent de preuve : une erreur se corrige par une annulation.
        </p>
      </Rubrique>
      <Rubrique titre="Vos droits">
        <p>
          Vous pouvez demander à voir, corriger ou faire effacer les données qui
          vous concernent, dans la limite de ce qui doit être conservé (reçus,
          journal).{" "}
          {lien ? (
            <>
              Écrivez-nous sur{" "}
              <a href={lien} className={lienTexte}>
                WhatsApp
              </a>
              .
            </>
          ) : (
            "Écrivez-nous avec les coordonnées des mentions légales."
          )}
        </p>
      </Rubrique>
    </PageTexte>
  );
}
