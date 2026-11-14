import type { Metadata } from "next";
import {
  lienTexte,
  PageTexte,
  Rubrique,
} from "@/components/vitrine/page-texte";
import { EDITEUR, MISE_A_JOUR_LEGALE } from "@/lib/vitrine/editeur";
import { lienContact } from "@/lib/vitrine/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Qui édite Kaya, qui l'héberge et comment nous contacter.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegales() {
  const lien = lienContact();
  const lignes: [string, string][] = [
    ["Nom", EDITEUR.nom],
    ["Statut", EDITEUR.statut],
    ["Ville", EDITEUR.ville],
    ...(EDITEUR.adresse
      ? [["Adresse", EDITEUR.adresse] as [string, string]]
      : []),
    ...(EDITEUR.formeJuridique
      ? [["Forme juridique", EDITEUR.formeJuridique] as [string, string]]
      : []),
    ...(EDITEUR.numeroRccm
      ? [["Numéro RCCM", EDITEUR.numeroRccm] as [string, string]]
      : []),
    ...(EDITEUR.numeroContribuable
      ? [
          ["Numéro de contribuable", EDITEUR.numeroContribuable] as [
            string,
            string,
          ],
        ]
      : []),
  ];
  return (
    <PageTexte titre="Mentions légales" miseAJour={MISE_A_JOUR_LEGALE}>
      <Rubrique titre="Qui édite Kaya ?">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {lignes.map(([terme, valeur]) => (
            <div key={terme} className="contents">
              <dt className="font-bold">{terme}</dt>
              <dd>{valeur}</dd>
            </div>
          ))}
        </dl>
        <p>Le directeur de la publication est {EDITEUR.nom}.</p>
      </Rubrique>
      <Rubrique titre="Nous contacter">
        <p>
          {lien ? (
            <>
              Écrivez-nous sur{" "}
              <a href={lien} className={lienTexte}>
                WhatsApp
              </a>
              {EDITEUR.email ? ` ou par email à ${EDITEUR.email}` : ""}. Nous
              répondons en français.
            </>
          ) : EDITEUR.email ? (
            `Écrivez-nous par email à ${EDITEUR.email}.`
          ) : (
            "Le contact de Kaya est indiqué dans votre espace après l'inscription."
          )}
        </p>
      </Rubrique>
      <Rubrique titre="Hébergement">
        <p>
          L&apos;application est hébergée par Vercel Inc. Les données des
          boutiques sont enregistrées chez Supabase, Inc., et les photos des
          produits chez Cloudflare (stockage R2).
        </p>
      </Rubrique>
      <Rubrique titre="Propriété du site">
        <p>
          Le nom Kaya, le logo, les textes, les images et le logiciel sont la
          propriété de leur éditeur. Les données que vous saisissez dans votre
          boutique (produits, clients, ventes) restent les vôtres.
        </p>
      </Rubrique>
      <Rubrique titre="Responsabilité">
        <p>
          Kaya vous aide à suivre votre boutique. Ce n&apos;est ni un conseil
          comptable, ni un conseil fiscal. Nous faisons le maximum pour que le
          service soit disponible, sans pouvoir garantir qu&apos;il ne sera
          jamais interrompu.
        </p>
      </Rubrique>
    </PageTexte>
  );
}
