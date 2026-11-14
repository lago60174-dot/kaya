import Link from "next/link";
import { FormulaireCloture } from "@/components/caisse/formulaire-cloture";
import { FormulaireDepense } from "@/components/caisse/formulaire-depense";
import { ValiderCloture } from "@/components/caisse/valider-cloture";
import {
  decalerJour,
  jourDemande,
  jourDouala,
  jugerEcart,
  libelleCategorie,
  libelleJour,
} from "@/lib/caisse/caisse";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { libelleMode } from "@/lib/ventes/paiements";
import { exigerRole } from "@/server/auth/session";
import {
  lireCaisse,
  listerClotures,
  type Cloture,
} from "@/server/caisse/lecture";

export const metadata = { title: "Caisse · Kaya" };

const jourLong = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${jour}T12:00:00Z`));

const lienJour =
  "flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold";

function Ligne({
  libelle,
  valeur,
  fort,
}: {
  libelle: string;
  valeur: string;
  fort?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${fort ? "text-lg font-bold" : "text-sm"}`}
    >
      <dt>{libelle}</dt>
      <dd className="whitespace-nowrap">{valeur}</dd>
    </div>
  );
}

function ResultatCloture({
  cloture,
  tolerance,
  attenduActuel,
  proprietaire,
}: {
  cloture: Cloture;
  tolerance: number;
  attenduActuel: number;
  proprietaire: boolean;
}) {
  const j = jugerEcart(cloture.ecart, tolerance, formatFcfa);
  return (
    <section
      aria-label="Caisse clôturée"
      className="border-border flex flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="text-lg font-semibold">Caisse clôturée</h2>
      <dl className="flex flex-col gap-1">
        <Ligne
          libelle="Espèces attendues"
          valeur={formatFcfa(cloture.especesAttendues)}
        />
        <Ligne
          libelle="Espèces comptées"
          valeur={formatFcfa(cloture.especesComptees)}
        />
        <Ligne
          libelle={cloture.ecart < 0 ? "Manque" : "Écart"}
          valeur={formatFcfa(cloture.ecart)}
          fort
        />
      </dl>
      <p
        className={`rounded-lg p-3 text-sm font-medium ${j.niveau === "alerte" ? "border-danger border" : "bg-brand-soft"}`}
      >
        {j.message}
      </p>
      {attenduActuel !== cloture.especesAttendues && (
        <p role="status" className="bg-brand-soft rounded-lg p-3 text-sm">
          Des mouvements ont été enregistrés après la clôture : la caisse
          attendue est maintenant de {formatFcfa(attenduActuel)}.
        </p>
      )}
      {cloture.cloturePar && (
        <p className="text-muted text-sm">Clôturée par {cloture.cloturePar}.</p>
      )}
      {cloture.validee ? (
        <p className="text-success text-sm font-semibold">
          Validée par le propriétaire.
        </p>
      ) : proprietaire ? (
        <ValiderCloture clotureId={cloture.id} />
      ) : (
        <p className="text-muted text-sm">
          En attente de validation par le propriétaire.
        </p>
      )}
    </section>
  );
}

export default async function PageCaisse({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profil = await exigerRole("boutique");
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId || !profil.role)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;

  const aujourdhui = jourDouala();
  const jour = jourDemande((await searchParams).date, aujourdhui);
  const estAujourdhui = jour === aujourdhui;
  const proprietaire = profil.role === "proprietaire";
  const supabase = await supabaseServeur();
  const [caisse, clotures] = await Promise.all([
    lireCaisse(supabase, boutiqueId, jour),
    listerClotures(supabase, boutiqueId),
  ]);
  if (!caisse)
    return (
      <p role="alert" className="text-danger">
        Impossible de charger la caisse. Vérifiez votre connexion et rechargez
        la page.
      </p>
    );
  const { resume: r, depenses } = caisse;
  const aValider = proprietaire
    ? clotures.filter((c) => !c.validee && c.date !== jour)
    : [];
  const mtn = r.mtnMomo - r.mtnMomoRembourse;
  const orange = r.orangeMoney - r.orangeMoneyRembourse;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Caisse du jour</h1>
        <p className="text-muted">{jourLong(jour)}</p>
        <nav aria-label="Choisir le jour" className="flex flex-wrap gap-2">
          <Link
            href={`/caisse?date=${decalerJour(jour, -1)}`}
            className={`${lienJour} border-border`}
          >
            ← {libelleJour(decalerJour(jour, -1), aujourdhui)}
          </Link>
          {!estAujourdhui && (
            <>
              <Link href="/caisse" className={`${lienJour} border-border`}>
                Aujourd&apos;hui
              </Link>
              {decalerJour(jour, 1) !== aujourdhui && (
                <Link
                  href={`/caisse?date=${decalerJour(jour, 1)}`}
                  className={`${lienJour} border-border`}
                >
                  {libelleJour(decalerJour(jour, 1), aujourdhui)} →
                </Link>
              )}
            </>
          )}
        </nav>
      </header>

      {aValider.length > 0 && (
        <section
          aria-label="Caisses à valider"
          className="bg-brand-soft flex flex-col gap-2 rounded-lg p-3"
        >
          <h2 className="text-lg font-semibold">À valider</h2>
          <ul className="flex flex-col gap-3">
            {aValider.map((c) => (
              <li key={c.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  <Link href={`/caisse?date=${c.date}`} className="underline">
                    {libelleJour(c.date, aujourdhui)}
                  </Link>{" "}
                  : écart {formatFcfa(c.ecart)}
                  {c.cloturePar ? ` (${c.cloturePar})` : ""}
                </p>
                <ValiderCloture clotureId={c.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-label="Résumé du jour"
        className="border-border flex flex-col gap-3 rounded-lg border p-3"
      >
        <div>
          <p className="text-muted text-sm">
            Ventes du jour ({r.nbVentes} vente{r.nbVentes > 1 ? "s" : ""})
          </p>
          <p className="text-3xl font-bold">{formatFcfa(r.ventesTotal)}</p>
        </div>
        <dl className="flex flex-col gap-1">
          <Ligne
            libelle="Espèces encaissées"
            valeur={formatFcfa(
              r.encaissementsEspeces + r.remboursementsCreditEspeces,
            )}
          />
          <Ligne libelle="MTN MoMo" valeur={formatFcfa(mtn)} />
          <Ligne libelle="Orange Money" valeur={formatFcfa(orange)} />
          <Ligne
            libelle="Vendu à crédit"
            valeur={formatFcfa(r.creditAccorde)}
          />
          <Ligne libelle="Dépenses" valeur={formatFcfa(r.depensesTotal)} />
        </dl>
        <p className="text-muted text-xs">
          Le Mobile Money et le crédit ne sont pas dans le tiroir-caisse : ils
          sont suivis à part.
        </p>
      </section>

      <section
        aria-label="Espèces attendues"
        className="bg-brand-soft flex flex-col gap-2 rounded-lg p-3"
      >
        <p className="text-sm font-medium">Espèces attendues dans le tiroir</p>
        <p className="text-3xl font-bold">{formatFcfa(r.especesAttendues)}</p>
        <dl className="flex flex-col gap-1">
          <Ligne
            libelle="+ Ventes en espèces"
            valeur={formatFcfa(r.encaissementsEspeces)}
          />
          <Ligne
            libelle="+ Crédits remboursés en espèces"
            valeur={formatFcfa(r.remboursementsCreditEspeces)}
          />
          <Ligne
            libelle="− Dépenses payées en espèces"
            valeur={formatFcfa(r.depensesEspeces)}
          />
          <Ligne
            libelle="− Ventes annulées remboursées"
            valeur={formatFcfa(r.avoirsEspeces)}
          />
        </dl>
      </section>

      {estAujourdhui && <FormulaireDepense role={profil.role} />}

      <section aria-label="Dépenses du jour" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Dépenses du jour</h2>
        {depenses.length === 0 ? (
          <p className="text-muted">Aucune dépense enregistrée ce jour.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {depenses.map((d) => (
              <li
                key={d.id}
                className="border-border flex items-baseline justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {libelleCategorie(d.categorie)}
                  </span>{" "}
                  · {libelleMode(d.mode)}
                  {d.note ? ` · ${d.note}` : ""}
                  <br />
                  <span className="text-muted">
                    {formatDateHeure(d.date)}
                    {d.auteur ? ` · ${d.auteur}` : ""}
                  </span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {formatFcfa(d.montant)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {caisse.cloture ? (
        <ResultatCloture
          cloture={caisse.cloture}
          tolerance={caisse.tolerance}
          attenduActuel={r.especesAttendues}
          proprietaire={proprietaire}
        />
      ) : (
        <FormulaireCloture
          date={jour}
          especesAttendues={r.especesAttendues}
          tolerance={caisse.tolerance}
        />
      )}

      {clotures.length > 0 && (
        <section
          aria-label="Dernières clôtures"
          className="flex flex-col gap-2"
        >
          <h2 className="text-lg font-semibold">Dernières clôtures</h2>
          <ul className="flex flex-col gap-2">
            {clotures.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/caisse?date=${c.date}`}
                  className="border-border flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <span className="font-medium">
                    {libelleJour(c.date, aujourdhui)}
                  </span>
                  <span>
                    écart {formatFcfa(c.ecart)} ·{" "}
                    {c.validee ? "validée" : "à valider"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
