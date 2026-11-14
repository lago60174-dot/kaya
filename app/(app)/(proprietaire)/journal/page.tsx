import Link from "next/link";
import { formatDateHeure } from "@/lib/format";
import {
  actionsFiltrees,
  lienJournal,
  lireCurseur,
  lireFiltres,
} from "@/lib/journal/filtres";
import {
  categoriesVisibles,
  decrire,
  libelleAction,
  lienEntite,
} from "@/lib/journal/journal";
import { peutUtiliser } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireJournal } from "@/server/journal/lecture";

export const metadata = { title: "Journal · Kaya" };

type Recherche = Record<string, string | undefined>;

const champ = "border-border min-h-11 rounded-lg border bg-white px-3";

export default async function PageJournal({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  const profil = await exigerRole("proprietaire");
  const p = await searchParams;
  const complet = profil.plan
    ? peutUtiliser(profil.plan, "journal_complet")
    : false;
  const filtres = lireFiltres(p, complet);

  const page = await lireJournal(await supabaseServeur(), {
    boutiqueId: null,
    actions: actionsFiltrees(filtres, complet),
    alertesSeulement: filtres.alertesSeulement,
    du: filtres.du,
    au: filtres.au,
    apres: lireCurseur(p),
  });
  const filtre = Boolean(
    filtres.categorie || filtres.alertesSeulement || filtres.du || filtres.au,
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold">Journal d&apos;activité</h1>
        <p className="text-muted mt-1 text-sm">
          {complet
            ? "Toutes les actions et toutes les alertes de votre boutique."
            : "Les ventes, annulations, remises et clôtures de caisse."}{" "}
          Rien ne peut être modifié ni effacé ici.
        </p>
      </header>

      <form
        method="get"
        aria-label="Filtrer le journal"
        className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-sm font-medium">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={filtres.categorie ?? ""}
            className={champ}
          >
            <option value="">Tout</option>
            {categoriesVisibles(complet).map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="du" className="text-sm font-medium">
            Du
          </label>
          <input
            id="du"
            name="du"
            type="date"
            defaultValue={filtres.du ?? ""}
            className={champ}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="au" className="text-sm font-medium">
            Au
          </label>
          <input
            id="au"
            name="au"
            type="date"
            defaultValue={filtres.au ?? ""}
            className={champ}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="alertes"
            value="1"
            defaultChecked={filtres.alertesSeulement}
            className="size-5"
          />
          Alertes seulement
        </label>
        <button
          type="submit"
          className="bg-brand-strong min-h-11 rounded-lg px-4 font-bold text-white"
        >
          Filtrer
        </button>
        {filtre && (
          <Link
            href="/journal"
            className="flex min-h-11 items-center text-sm font-semibold underline"
          >
            Tout afficher
          </Link>
        )}
      </form>

      {!page ? (
        <p role="alert" className="text-danger">
          Impossible de charger le journal. Vérifiez votre connexion et
          rechargez la page.
        </p>
      ) : page.entrees.length === 0 ? (
        <p className="text-muted">
          {filtre
            ? "Aucune activité ne correspond à ces filtres."
            : "Aucune activité enregistrée pour le moment."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {page.entrees.map((e) => {
            const lien = lienEntite(e.entite, e.entiteId, e.details);
            const contenu = (
              <>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {libelleAction(e.action)}
                  </span>
                  {e.alerte && (
                    <span className="border-danger text-danger rounded-full border px-2 text-xs font-semibold">
                      Alerte
                    </span>
                  )}
                </span>
                <span className="block">{decrire(e.action, e.details)}</span>
                <span className="text-muted block">
                  {formatDateHeure(e.creeLe)}
                  {e.auteur ? ` · ${e.auteur}` : ""}
                </span>
              </>
            );
            const style = `rounded-lg border p-3 text-sm ${e.alerte ? "border-danger" : "border-border"}`;
            return (
              <li key={e.id}>
                {lien ? (
                  <Link href={lien} className={`${style} block min-h-11`}>
                    {contenu}
                  </Link>
                ) : (
                  <div className={style}>{contenu}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {page?.suivant && (
        <Link
          href={lienJournal(filtres, page.suivant)}
          className="border-border flex min-h-12 items-center justify-center rounded-lg border font-semibold"
        >
          Voir les entrées plus anciennes
        </Link>
      )}
    </div>
  );
}
