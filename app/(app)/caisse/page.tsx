import { Banknote, Car, ChartColumn, Flag, Plus, Receipt, Wallet, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Beigne } from "@/components/caisse/beigne";
import { SelecteurJour } from "@/components/caisse/selecteur-jour";
import { AnnulerDepense } from "@/components/caisse/annuler-depense";
import { FormulaireCloture } from "@/components/caisse/formulaire-cloture";
import { FormulaireDepense } from "@/components/caisse/formulaire-depense";
import { ValiderCloture } from "@/components/caisse/valider-cloture";
import {
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

const ICONES: Record<string, LucideIcon> = { transport: Car, electricite: Zap, salaire: Banknote };
const heure = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(new Date(d));

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
      className="border-border flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm"
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
    <div className="kaya-cash-page flex max-w-xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <Wallet aria-hidden="true" size={26} />
          </span>
          <div>
            <h1 className="text-xl font-bold">Caisse du jour</h1>
            <p className="text-muted text-sm">Suivez votre encaissement en temps réel</p>
          </div>
        </div>
        <SelecteurJour jour={jour} max={aujourdhui} />
      </header>

      {aValider.length > 0 && (
        <section
          aria-label="Caisses à valider"
          className="bg-brand-soft flex flex-col gap-2 rounded-2xl p-4"
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

      <div role="group" aria-label="Encaissements du jour" className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <p className="rounded-2xl p-3 text-white" style={{ background: "linear-gradient(180deg,#ff8b1a,#f26a0f)" }}>
          <span className="block text-sm">Ventes du jour</span>
          <b className="block text-lg font-extrabold">{formatFcfa(r.ventesTotal)}</b>
          <span className="block text-xs">{r.nbVentes} vente{r.nbVentes > 1 ? "s" : ""}</span>
        </p>
        <p className="rounded-2xl p-3" style={{ background: "#fdeee3" }}>
          <span className="block text-sm">Espèces</span>
          <b className="block text-lg font-extrabold">{formatFcfa(r.encaissementsEspeces + r.remboursementsCreditEspeces)}</b>
        </p>
        <p className="rounded-2xl p-3" style={{ background: "#e4edff" }}>
          <span className="block text-sm">Mobile Money</span>
          <b className="block text-lg font-extrabold">{formatFcfa(mtn + orange)}</b>
        </p>
        <p className="rounded-2xl p-3" style={{ background: "#dff4e7" }}>
          <span className="block text-sm">Crédit</span>
          <b className="block text-lg font-extrabold">{formatFcfa(r.creditAccorde)}</b>
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section
          aria-label="Résumé du jour"
          className="flex flex-col gap-4 rounded-2xl border border-[#eee3da] bg-white p-4 shadow-sm"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ChartColumn aria-hidden="true" size={22} className="text-orange-600" />
            Détail des encaissements
          </h2>
          <Beigne
            parts={[
              { libelle: "Espèces", montant: r.encaissementsEspeces + r.remboursementsCreditEspeces, couleur: "#f26a0f" },
              { libelle: "MTN MoMo", montant: mtn, couleur: "#3b82f6" },
              { libelle: "Orange Money", montant: orange, couleur: "#f5a000" },
              { libelle: "Crédit", montant: r.creditAccorde, couleur: "#22c55e" },
            ]}
          />
          <p className="text-sm">
            Dépenses du jour : <b>{formatFcfa(r.depensesTotal)}</b>
          </p>
          <p className="text-muted text-xs">
            Le Mobile Money et le crédit ne sont pas dans le tiroir-caisse : ils sont suivis à part.
          </p>
        </section>
        <section
          aria-label="Espèces attendues"
          className="flex flex-col gap-2 rounded-2xl border border-[#ffd9b7] bg-[#fff1e4] p-4"
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
          {caisse.cloture && (
            <p
              className={`mt-1 rounded-xl p-3 text-sm font-bold ${jugerEcart(caisse.cloture.ecart, caisse.tolerance, formatFcfa).niveau === "alerte" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}
            >
              Écart : {formatFcfa(caisse.cloture.ecart)}
              <span className="block font-medium">
                {jugerEcart(caisse.cloture.ecart, caisse.tolerance, formatFcfa).niveau === "alerte" ? "À vérifier" : "Écart OK"}
              </span>
            </p>
          )}
        </section>
      </div>

      <section aria-label="Dépenses du jour" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Dépenses du jour</h2>
        {depenses.length === 0 ? (
          <p className="text-muted">Aucune dépense enregistrée ce jour.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {depenses.map((d) => (
              <li
                key={d.id}
                className="border-border flex flex-col rounded-2xl border bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icone = ICONES[d.categorie] ?? Receipt;
                    return (
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
                        <Icone size={20} />
                      </span>
                    );
                  })()}
                  <span className={`flex-1 ${d.annulee ? "text-muted line-through" : ""}`}>
                    <span className="font-medium">
                      {libelleCategorie(d.categorie)}
                    </span>{" "}
                    · {libelleMode(d.mode)}
                    {d.note ? ` · ${d.note}` : ""}
                    <br />
                    <span className="text-muted">
                      {estAujourdhui ? heure(d.date) : formatDateHeure(d.date)}
                      {d.auteur ? ` · ${d.auteur}` : ""}
                    </span>
                  </span>
                  <span
                    className={`font-semibold whitespace-nowrap ${d.annulee ? "text-muted line-through" : ""}`}
                  >
                    {formatFcfa(d.montant)}
                  </span>
                </div>
                {d.annulee && (
                  <p className="text-danger text-xs">
                    Annulée : {d.motifAnnulation}
                  </p>
                )}
                {proprietaire && !d.annulee && !caisse.cloture && (
                  <AnnulerDepense depenseId={d.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {estAujourdhui && !caisse.cloture && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href="#depense"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-orange-400 bg-white px-4 text-base font-bold text-orange-600"
          >
            <Plus aria-hidden="true" size={22} />
            Ajouter une dépense
          </a>
          <a
            href="#cloture"
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold text-white shadow-[0_10px_24px_rgba(242,106,15,0.3)]"
            style={{ background: "linear-gradient(110deg,#ff8b1a,#f26a0f)" }}
          >
            <Flag aria-hidden="true" size={22} />
            Clôturer la caisse
          </a>
        </div>
      )}

      {estAujourdhui && (
        <div id="depense">
        {caisse.cloture ? (
          <p role="status" className="bg-brand-soft rounded-lg p-3 text-sm">
            La caisse du jour est clôturée : une nouvelle dépense se saisit
            demain.
          </p>
        ) : (
          <FormulaireDepense role={profil.role} />
        )}
        </div>
      )}

      <div id="cloture">
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
          totalVentes={r.ventesTotal}
          totalDepenses={r.depensesTotal}
          especesAttendues={r.especesAttendues}
          tolerance={caisse.tolerance}
        />
      )}
      </div>

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
