"use client";

import { useActionState, useMemo, useState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import { suggestionsUnites } from "@/lib/stock/unites";
import {
  enregistrerProduitAction,
  type EtatStock,
} from "@/server/stock/actions";
import { ChampPhoto } from "./champ-photo";

interface Option {
  id: string;
  nom: string;
}

interface LigneUnite {
  id?: string;
  nom: string;
  facteur: string;
  prixVente: string;
}

export interface ProduitInitial {
  id?: string;
  nom?: string;
  categorieId?: string | null;
  marqueId?: string | null;
  uniteBase?: string;
  seuilAlerte?: string;
  prixAchat?: string;
  actif?: boolean;
  imageCle?: string | null;
  vignetteCle?: string | null;
  codeBarres?: string | null;
  unites?: LigneUnite[];
}

const champSelect =
  "min-h-11 rounded-lg border border-border bg-white px-3 text-base";
const petitBouton =
  "min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-brand-soft";

export function FormulaireProduit({
  categories,
  marques,
  initial = {},
}: {
  categories: Option[];
  marques: Option[];
  initial?: ProduitInitial;
}) {
  const [etat, action] = useActionState<EtatStock, FormData>(
    enregistrerProduitAction,
    {},
  );
  const [uniteBase, setUniteBase] = useState(initial.uniteBase ?? "");
  const [unites, setUnites] = useState<LigneUnite[]>(
    initial.unites?.length
      ? initial.unites
      : [{ nom: "", facteur: "1", prixVente: "" }],
  );
  const suggestions = useMemo(
    () =>
      suggestionsUnites(uniteBase).filter(
        (s) => !unites.some((u) => u.nom.toLowerCase() === s.nom.toLowerCase()),
      ),
    [uniteBase, unites],
  );
  const c = etat.champs;

  const maj = (i: number, patch: Partial<LigneUnite>) =>
    setUnites((l) => l.map((u, j) => (j === i ? { ...u, ...patch } : u)));

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <Champ
        nom="nom"
        libelle="Nom du produit"
        defaultValue={initial.nom}
        required
        erreur={c?.nom}
        aide="Sans la marque : par exemple « Ciment CPJ 42,5 »."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="marqueId" className="text-sm font-medium">
            Marque
          </label>
          <select
            id="marqueId"
            name="marqueId"
            defaultValue={initial.marqueId ?? ""}
            className={champSelect}
          >
            <option value="">Sans marque</option>
            {marques.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
        <Champ
          nom="nouvelleMarque"
          libelle="Ou nouvelle marque"
          erreur={c?.nouvelleMarque}
          placeholder="Dangote, CIMAF…"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="categorieId" className="text-sm font-medium">
            Catégorie
          </label>
          <select
            id="categorieId"
            name="categorieId"
            defaultValue={initial.categorieId ?? ""}
            className={champSelect}
          >
            <option value="">Sans catégorie</option>
            {categories.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
        <Champ
          nom="nouvelleCategorie"
          libelle="Ou nouvelle catégorie"
          erreur={c?.nouvelleCategorie}
        />
      </div>

      <Champ
        nom="uniteBase"
        libelle="Unité de base (celle du stock)"
        value={uniteBase}
        onChange={(e) => setUniteBase(e.target.value)}
        required
        list="unites-courantes"
        erreur={c?.uniteBase}
        aide="Le stock est toujours compté dans cette unité : kg, mètre, pot, pièce, barre…"
      />
      <datalist id="unites-courantes">
        {["kg", "mètre", "litre", "pot", "pièce", "barre"].map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <fieldset className="border-border flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          Façons de vendre (conditionnements)
        </legend>
        <p className="text-muted text-sm">
          Ex. : sac de 50 kg (facteur 50), sac de 25 kg (facteur 25), kg
          (facteur 1). Le facteur est le nombre d&apos;unités de base dans
          l&apos;unité vendue.
        </p>
        {unites.map((u, i) => (
          <div
            key={u.id ?? i}
            className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2"
          >
            <Champ
              nom={`u-nom-${i}`}
              libelle="Nom"
              value={u.nom}
              onChange={(e) => maj(i, { nom: e.target.value })}
            />
            <Champ
              nom={`u-fac-${i}`}
              libelle="Facteur"
              inputMode="decimal"
              value={u.facteur}
              onChange={(e) => maj(i, { facteur: e.target.value })}
            />
            <Champ
              nom={`u-prix-${i}`}
              libelle="Prix (FCFA)"
              inputMode="numeric"
              value={u.prixVente}
              onChange={(e) => maj(i, { prixVente: e.target.value })}
            />
            <button
              type="button"
              aria-label={`Retirer l'unité ${u.nom || i + 1}`}
              disabled={unites.length === 1}
              onClick={() => setUnites((l) => l.filter((_, j) => j !== i))}
              className={petitBouton}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setUnites((l) => [...l, { nom: "", facteur: "1", prixVente: "" }])
            }
            className={petitBouton}
          >
            + Ajouter une unité
          </button>
          {suggestions.map((s) => (
            <button
              key={s.nom}
              type="button"
              onClick={() =>
                setUnites((l) => [
                  ...l.filter((x) => x.nom || x.prixVente),
                  { nom: s.nom, facteur: String(s.facteur), prixVente: "" },
                ])
              }
              className={petitBouton}
            >
              + {s.nom}
            </button>
          ))}
        </div>
        {(c?.unites || etat.erreur) && (
          <p role="alert" className="text-danger text-sm">
            {c?.unites ?? etat.erreur}
          </p>
        )}
        <input type="hidden" name="unites" value={JSON.stringify(unites)} />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Champ
          nom="prixAchat"
          libelle="Prix d'achat par unité de base (FCFA)"
          inputMode="numeric"
          defaultValue={initial.prixAchat ?? "0"}
          required
          erreur={c?.prixAchat}
        />
        <Champ
          nom="seuilAlerte"
          libelle="Alerte quand le stock passe sous"
          inputMode="decimal"
          defaultValue={initial.seuilAlerte ?? "0"}
          required
          erreur={c?.seuilAlerte}
        />
      </div>
      <Champ
        nom="codeBarres"
        libelle="Code-barres (facultatif)"
        defaultValue={initial.codeBarres ?? ""}
      />
      <ChampPhoto
        imageCle={initial.imageCle}
        vignetteCle={initial.vignetteCle}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="actif"
          defaultChecked={initial.actif ?? true}
          className="size-5"
        />
        Produit en vente
      </label>

      {etat.erreur && !c?.unites && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      <BoutonEnvoi enCours="Enregistrement…">
        Enregistrer le produit
      </BoutonEnvoi>
    </form>
  );
}
