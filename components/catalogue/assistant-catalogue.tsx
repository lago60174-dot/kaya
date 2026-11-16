"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Champ } from "@/components/auth/champ";
import { ChampPhoto } from "@/components/stock/champ-photo";
import { cleVignetteCatalogue, normaliserTexte } from "@/lib/catalogue/outils";
import type { ProduitCatalogue } from "@/lib/catalogue/types";
import { lireMontant } from "@/lib/stock/quantites";
import { urlImage } from "@/server/images/cles";
import {
  importerCatalogueAction,
  type ResultatImport,
} from "@/server/catalogue/actions";

/** Ce que le commerçant modifie avant l'import ; tout est du texte tant qu'il n'est pas validé. */
interface Saisie {
  nom: string;
  achat: string;
  prix: Record<string, string>;
  imageCle?: string;
  vignetteCle?: string;
}

type Coches = Record<string, Saisie>;

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold";

/** Montant saisi : vide = pas de prix, sinon entier FCFA valide. Null si la saisie est invalide. */
function lire(texte: string | undefined): number | null {
  if (!texte || texte.trim() === "") return 0;
  return lireMontant(texte);
}

function saisieValide(p: ProduitCatalogue, s: Saisie): string | null {
  if (s.nom.trim().length < 2) return `Le nom de « ${p.nom} » est trop court.`;
  if (lire(s.achat) === null)
    return `Prix d'achat de « ${p.nom} » : entrez des chiffres seulement.`;
  for (const c of p.conditionnements)
    if (lire(s.prix[c.nom]) === null)
      return `Prix de « ${p.nom} » (${c.nom}) : entrez des chiffres seulement.`;
  return null;
}

const aUnPrix = (p: ProduitCatalogue, s: Saisie) =>
  p.conditionnements.some((c) => (lire(s.prix[c.nom]) ?? 0) > 0);

function nettoyerBrouillon(
  brut: unknown,
  produits: Map<string, ProduitCatalogue>,
  exclus: Set<string>,
): Coches {
  const sortie: Coches = {};
  if (typeof brut !== "object" || brut === null) return sortie;
  for (const [ref, v] of Object.entries(brut as Record<string, unknown>)) {
    const p = produits.get(ref);
    if (!p || exclus.has(ref) || typeof v !== "object" || v === null) continue;
    const s = v as Partial<Saisie>;
    const prix: Record<string, string> = {};
    for (const c of p.conditionnements)
      if (typeof s.prix?.[c.nom] === "string") prix[c.nom] = s.prix[c.nom];
    sortie[ref] = {
      nom: typeof s.nom === "string" ? s.nom : p.nom,
      achat: typeof s.achat === "string" ? s.achat : "",
      prix,
      imageCle: typeof s.imageCle === "string" ? s.imageCle : undefined,
      vignetteCle: typeof s.vignetteCle === "string" ? s.vignetteCle : undefined,
    };
  }
  return sortie;
}

/**
 * Étape d'onboarding : le propriétaire coche ce qu'il vend dans le catalogue modèle, ajuste les noms et saisit ses prix.
 * Le brouillon est gardé sur l'appareil : la saisie peut durer plusieurs heures, voire plusieurs jours.
 */
export function AssistantCatalogue({
  produits,
  dejaPresents,
  cleBrouillon,
  premiereFois,
}: {
  produits: ProduitCatalogue[];
  dejaPresents: string[];
  cleBrouillon: string;
  premiereFois: boolean;
}) {
  const parRef = useMemo(
    () => new Map(produits.map((p) => [p.ref, p])),
    [produits],
  );
  const deja = useMemo(() => new Set(dejaPresents), [dejaPresents]);
  const categories = useMemo(
    () => [...new Set(produits.map((p) => p.categorie))],
    [produits],
  );

  const [coches, setCoches] = useState<Coches>({});
  const [categorie, setCategorie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [pret, setPret] = useState(false);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  // Reprise du brouillon enregistré sur cet appareil (le stockage peut être indisponible : l'assistant marche sans).
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(cleBrouillon);
      if (brut)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCoches(nettoyerBrouillon(JSON.parse(brut), parRef, deja));
    } catch {
      /* brouillon illisible ou stockage bloqué : on repart de zéro */
    }
    setPret(true);
  }, [cleBrouillon, parRef, deja]);

  useEffect(() => {
    if (!pret) return;
    try {
      if (Object.keys(coches).length > 0)
        window.localStorage.setItem(cleBrouillon, JSON.stringify(coches));
      else window.localStorage.removeItem(cleBrouillon);
    } catch {
      /* stockage plein ou bloqué : le brouillon n'est simplement pas gardé */
    }
  }, [coches, pret, cleBrouillon]);

  const visibles = useMemo(() => {
    const terme = normaliserTexte(recherche.trim());
    return produits.filter((p) => {
      if (!terme && categorie && p.categorie !== categorie) return false;
      if (!terme) return true;
      const meule = normaliserTexte(
        [p.nom, p.marque, p.sousCategorie, p.categorie, ...p.synonymes]
          .filter(Boolean)
          .join(" "),
      );
      return terme.split(/\s+/).every((mot) => meule.includes(mot));
    });
  }, [produits, categorie, recherche]);

  const refsCochees = Object.keys(coches);
  const nbSansPrix = refsCochees.filter((r) => {
    const p = parRef.get(r);
    return p && !aUnPrix(p, coches[r]);
  }).length;

  function basculer(p: ProduitCatalogue) {
    setCoches((c) => {
      if (!c[p.ref]) return { ...c, [p.ref]: { nom: p.nom, achat: "", prix: {} } };
      const suite = { ...c };
      delete suite[p.ref];
      return suite;
    });
  }

  function toutCocher(cocher: boolean) {
    setCoches((c) => {
      const suite = { ...c };
      for (const p of visibles) {
        if (deja.has(p.ref)) continue;
        if (cocher) suite[p.ref] ??= { nom: p.nom, achat: "", prix: {} };
        else delete suite[p.ref];
      }
      return suite;
    });
  }

  const maj = (ref: string, patch: Partial<Saisie>) =>
    setCoches((c) => (c[ref] ? { ...c, [ref]: { ...c[ref], ...patch } } : c));

  function importer() {
    setErreur(null);
    for (const ref of refsCochees) {
      const p = parRef.get(ref);
      const probleme = p ? saisieValide(p, coches[ref]) : null;
      if (probleme) {
        setErreur(probleme);
        return;
      }
    }
    const entrees = refsCochees.map((ref) => {
      const p = parRef.get(ref) as ProduitCatalogue;
      const s = coches[ref];
      return {
        ref,
        nom: s.nom.trim(),
        prixAchat: lire(s.achat) ?? 0,
        prixVente: Object.fromEntries(
          p.conditionnements.map((c) => [c.nom, lire(s.prix[c.nom]) ?? 0]),
        ),
        ...(!p.image && s.imageCle && s.vignetteCle
          ? { imageCle: s.imageCle, vignetteCle: s.vignetteCle }
          : {}),
      };
    });
    demarrer(async () => {
      const r = await importerCatalogueAction(entrees);
      if (r.erreur) {
        setErreur(r.erreur);
        return;
      }
      try {
        window.localStorage.removeItem(cleBrouillon);
      } catch {
        /* sans importance */
      }
      setPret(false);
      setCoches({});
      setResultat(r);
    });
  }

  if (resultat) return <Termine resultat={resultat} />;

  return (
    <div className="flex max-w-2xl flex-col gap-4 pb-28">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          {premiereFois ? "Remplissez votre stock en quelques minutes" : "Catalogue modèle"}
        </h1>
        <p className="text-muted">
          Cochez ce que vous vendez et saisissez vos prix de vente. Les noms,
          unités et photos sont déjà prêts. Tout reste modifiable plus tard dans
          Stock, et vous pouvez revenir ici quand vous voulez : votre sélection
          est gardée sur cet appareil.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="recherche-catalogue" className="text-sm font-medium">
            Chercher un produit
          </label>
          <input
            id="recherche-catalogue"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="ciment, fer de 10, cadenas…"
            className="border-border focus:border-brand-strong focus:outline-brand min-h-11 rounded-lg border bg-white px-3 text-base focus:outline-2"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Catégories">
          {[["", "Tout"], ...categories.map((c) => [c, c])].map(([valeur, nom]) => {
            const dans = produits.filter((p) => !valeur || p.categorie === valeur);
            const nb = dans.filter((p) => coches[p.ref]).length;
            const actif = categorie === valeur && !recherche.trim();
            return (
              <button
                key={valeur}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => {
                  setCategorie(valeur);
                  setRecherche("");
                }}
                className={`min-h-11 shrink-0 rounded-full border px-3 text-sm font-medium ${
                  actif
                    ? "bg-brand-strong border-transparent text-white"
                    : "border-border hover:bg-brand-soft"
                }`}
              >
                {nom}
                <span className={actif ? "opacity-80" : "text-muted"}>
                  {" "}
                  · {nb > 0 ? `${nb}/` : ""}
                  {dans.length}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toutCocher(true)}
            className="border-border hover:bg-brand-soft min-h-11 rounded-lg border px-3 text-sm font-medium"
          >
            Tout cocher ({visibles.filter((p) => !deja.has(p.ref)).length})
          </button>
          <button
            type="button"
            onClick={() => toutCocher(false)}
            className="border-border hover:bg-brand-soft min-h-11 rounded-lg border px-3 text-sm font-medium"
          >
            Tout décocher
          </button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          Aucun produit du catalogue ne correspond. Vous pourrez l&apos;ajouter à
          la main dans Stock après l&apos;import.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((p) => (
            <LigneProduit
              key={p.ref}
              produit={p}
              saisie={coches[p.ref]}
              dejaPresent={deja.has(p.ref)}
              onBascule={() => basculer(p)}
              onChange={(patch) => maj(p.ref, patch)}
            />
          ))}
        </ul>
      )}

      <div className="bg-background border-border fixed inset-x-0 bottom-0 z-20 border-t p-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {erreur && (
            <p role="alert" className="text-danger text-sm">
              {erreur}
            </p>
          )}
          <p className="text-sm" aria-live="polite">
            <strong>{refsCochees.length}</strong> produit
            {refsCochees.length > 1 ? "s" : ""} coché
            {refsCochees.length > 1 ? "s" : ""}
            {nbSansPrix > 0 && (
              <span className="text-muted">
                {" "}
                · {nbSansPrix} sans prix (créé{nbSansPrix > 1 ? "s" : ""}{" "}
                masqué{nbSansPrix > 1 ? "s" : ""})
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={refsCochees.length === 0 || enCours}
              onClick={importer}
              className={`${bouton} bg-brand-strong flex-1 text-white disabled:opacity-50`}
            >
              {enCours ? "Import en cours…" : "Ajouter à ma boutique"}
            </button>
            <Link
              href={premiereFois ? "/patron" : "/stock"}
              className={`${bouton} border-border border`}
            >
              {premiereFois ? "Passer" : "Retour"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function LigneProduit({
  produit: p,
  saisie,
  dejaPresent,
  onBascule,
  onChange,
}: {
  produit: ProduitCatalogue;
  saisie: Saisie | undefined;
  dejaPresent: boolean;
  onBascule: () => void;
  onChange: (patch: Partial<Saisie>) => void;
}) {
  const id = `cat-${p.ref}`;
  return (
    <li
      className={`rounded-lg border ${saisie ? "border-brand-strong" : "border-border"}`}
    >
      <label
        htmlFor={id}
        className={`flex min-h-14 items-center gap-3 p-3 ${dejaPresent ? "opacity-60" : "cursor-pointer"}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={Boolean(saisie)}
          disabled={dejaPresent}
          onChange={onBascule}
          className="size-5 shrink-0"
        />
        {p.image ? (
          // Vignette WebP de 200 px (R2, via /img), chargée à la demande.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlImage(cleVignetteCatalogue(p.image))}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            className="size-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="bg-brand-soft text-brand-strong grid size-12 shrink-0 place-items-center rounded-md font-semibold"
          >
            {p.nom.charAt(0)}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">
            {p.nom}
            {p.marque && <span className="text-muted"> · {p.marque}</span>}
          </span>
          <span className="text-muted text-sm">
            {p.conditionnements.map((c) => c.nom).join(" · ")}
          </span>
          <span className="flex flex-wrap gap-1 pt-0.5 empty:hidden">
            {dejaPresent && <Pastille>Déjà dans votre boutique</Pastille>}
            {p.aVerifier && <Pastille>À vérifier</Pastille>}
            {!p.image && !dejaPresent && <Pastille>Sans photo</Pastille>}
          </span>
        </span>
      </label>

      {saisie && (
        <div className="border-border flex flex-col gap-3 border-t p-3">
          {p.aVerifier && p.note && (
            <p className="bg-brand-soft rounded-md p-2 text-sm">{p.note}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {p.conditionnements.map((c) => (
              <Champ
                key={c.nom}
                nom={`prix-${p.ref}-${c.facteur}`}
                idChamp={`prix-${p.ref}-${c.facteur}-${c.nom}`}
                libelle={`Prix de vente : ${c.nom} (FCFA)`}
                inputMode="numeric"
                placeholder="Laissez vide si vous ne le vendez pas ainsi"
                value={saisie.prix[c.nom] ?? ""}
                onChange={(e) =>
                  onChange({ prix: { ...saisie.prix, [c.nom]: e.target.value } })
                }
                className="border-border focus:border-brand-strong focus:outline-brand min-h-11 rounded-lg border bg-white px-3 text-base focus:outline-2"
              />
            ))}
          </div>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-medium">
              Modifier le nom, le prix d&apos;achat
              {!p.image ? " ou ajouter une photo" : ""}
            </summary>
            <div className="flex flex-col gap-3 pt-1">
              <Champ
                nom={`nom-${p.ref}`}
                libelle="Nom du produit"
                value={saisie.nom}
                onChange={(e) => onChange({ nom: e.target.value })}
                className="border-border focus:border-brand-strong focus:outline-brand min-h-11 rounded-lg border bg-white px-3 text-base focus:outline-2"
              />
              <Champ
                nom={`achat-${p.ref}`}
                libelle={`Prix d'achat par ${p.uniteBase} (FCFA, facultatif)`}
                inputMode="numeric"
                value={saisie.achat}
                onChange={(e) => onChange({ achat: e.target.value })}
                aide="Visible par vous seul. Sert à calculer votre marge."
                className="border-border focus:border-brand-strong focus:outline-brand min-h-11 rounded-lg border bg-white px-3 text-base focus:outline-2"
              />
              {!p.image && (
                <ChampPhoto
                  imageCle={saisie.imageCle}
                  vignetteCle={saisie.vignetteCle}
                  onChange={(imageCle, vignetteCle) =>
                    onChange({
                      imageCle: imageCle || undefined,
                      vignetteCle: vignetteCle || undefined,
                    })
                  }
                />
              )}
            </div>
          </details>
        </div>
      )}
    </li>
  );
}

function Pastille({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-brand-soft text-brand-strong rounded-full px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

function Termine({ resultat }: { resultat: ResultatImport }) {
  const { crees = 0, ignores = 0, sansPrix = 0, sansPhoto = 0 } = resultat;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold">
        {crees} produit{crees > 1 ? "s" : ""} ajouté{crees > 1 ? "s" : ""} à
        votre boutique
      </h1>
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {sansPrix > 0 && (
          <li>
            <strong>{sansPrix}</strong> sans prix de vente : ils sont masqués à
            la vente. Ouvrez-les dans Stock, saisissez le prix, puis cochez
            « actif ».
          </li>
        )}
        {sansPhoto > 0 && (
          <li>
            <strong>{sansPhoto}</strong> sans photo : ajoutez-la depuis la fiche
            du produit (Stock, puis Modifier).
          </li>
        )}
        {ignores > 0 && (
          <li>
            <strong>{ignores}</strong> déjà présent{ignores > 1 ? "s" : ""} :
            laissé{ignores > 1 ? "s" : ""} tel{ignores > 1 ? "s" : ""} quel
            {ignores > 1 ? "s" : ""}.
          </li>
        )}
        <li>
          Le stock de départ de chaque produit est à 0 : enregistrez vos
          quantités avec une entrée de stock.
        </li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href="/stock" className={`${bouton} bg-brand-strong text-white`}>
          Voir mon stock
        </Link>
        <Link href="/patron" className={`${bouton} border-border border`}>
          Aller au tableau de bord
        </Link>
      </div>
    </div>
  );
}
