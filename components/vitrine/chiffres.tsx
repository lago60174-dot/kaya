import { formatFcfa } from "@/lib/format";
import { chiffresAffichables, type ChiffresPublics } from "@/lib/vitrine/offre";

const titre =
  "font-affiche text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[0.92] max-w-[16ch]";

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);
const nombre = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ");

/** Chiffres réels de l'usage de Kaya. Masqués tant qu'ils ne reposent pas sur un vrai usage. */
export function Chiffres({ chiffres }: { chiffres: ChiffresPublics | null }) {
  if (!chiffresAffichables(chiffres)) return null;
  const items = [
    {
      valeur: nombre(chiffres.boutiques),
      libelle: pluriel(chiffres.boutiques, "quincaillerie utilise Kaya", "quincailleries utilisent Kaya"),
    },
    {
      valeur: nombre(chiffres.ventes),
      libelle: pluriel(chiffres.ventes, "vente enregistrée", "ventes enregistrées"),
    },
    {
      valeur: formatFcfa(chiffres.montantVentes),
      libelle: "de ventes suivies, sans cahier",
    },
    ...(chiffres.creditsRecouvres > 0
      ? [{ valeur: formatFcfa(chiffres.creditsRecouvres), libelle: "de crédits clients remboursés et notés" }]
      : []),
    ...(chiffres.produits >= 10
      ? [{ valeur: nombre(chiffres.produits), libelle: "produits comptés en stock" }]
      : []),
  ];
  return (
    <section className="bg-brand text-goudron py-14" aria-label="Kaya en chiffres">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <h2 className={titre}>Kaya, en vrais chiffres.</h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <div key={i.libelle}>
              <dt className="sr-only">{i.libelle}</dt>
              <dd className="font-affiche text-4xl leading-none">{i.valeur}</dd>
              <dd className="mt-2 font-bold">{i.libelle}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
