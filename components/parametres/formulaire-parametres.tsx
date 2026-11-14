"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import {
  enregistrerParametresAction,
  type EtatParametres,
} from "@/server/parametres/actions";
import type { ParametresLus } from "@/server/parametres/lecture";

/** Boutique (nom, contact, pied de reçu) et règles de gestion, enregistrés ensemble. */
export function FormulaireParametres({ valeurs }: { valeurs: ParametresLus }) {
  const [etat, action] = useActionState<EtatParametres, FormData>(
    enregistrerParametresAction,
    {},
  );
  const c = etat.champs ?? {};
  return (
    <form action={action} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Ma boutique</h2>
        <Champ
          nom="nom"
          libelle="Nom de la boutique"
          required
          defaultValue={valeurs.nom}
          erreur={c.nom}
        />
        <Champ
          nom="adresse"
          libelle="Adresse"
          defaultValue={valeurs.adresse}
          erreur={c.adresse}
        />
        <Champ
          nom="telephone"
          libelle="Téléphone"
          type="tel"
          inputMode="tel"
          defaultValue={valeurs.telephone}
          erreur={c.telephone}
          aide="Affiché sur les reçus."
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="mentionLegale" className="text-sm font-medium">
            Message en bas des reçus
          </label>
          <textarea
            id="mentionLegale"
            name="mentionLegale"
            rows={3}
            maxLength={300}
            defaultValue={valeurs.mentionLegale}
            aria-invalid={c.mentionLegale ? true : undefined}
            className="border-border focus:border-brand-strong focus:outline-brand rounded-lg border bg-white px-3 py-2 text-base focus:outline-2"
          />
          <p
            className={
              c.mentionLegale ? "text-danger text-sm" : "text-muted text-sm"
            }
          >
            {c.mentionLegale ??
              "Par exemple : « Merci de votre confiance. Échange sous 7 jours avec le reçu. »"}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Règles de la boutique</h2>
        <Champ
          nom="seuilRemise"
          libelle="Remise maximale d'un vendeur (%)"
          inputMode="decimal"
          required
          defaultValue={String(valeurs.seuilRemise).replace(".", ",")}
          erreur={c.seuilRemise}
          aide="Au-delà, la vente est signalée dans le journal."
        />
        <Champ
          nom="plafondCredit"
          libelle="Plafond de crédit par défaut (FCFA)"
          inputMode="numeric"
          required
          defaultValue={String(valeurs.plafondCredit)}
          erreur={c.plafondCredit}
          aide="Appliqué aux nouveaux clients. Les clients existants gardent leur plafond."
        />
        <Champ
          nom="ecartTolere"
          libelle="Écart de caisse toléré (FCFA)"
          inputMode="numeric"
          required
          defaultValue={String(valeurs.ecartTolere)}
          erreur={c.ecartTolere}
          aide="Un écart plus grand à la clôture déclenche une alerte."
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">
            Vendre un produit sans stock
          </legend>
          {[
            ["non", "Non : la vente est refusée si le stock manque"],
            [
              "oui",
              "Oui : le stock peut devenir négatif (une alerte est créée)",
            ],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                name="stockNegatif"
                value={v}
                defaultChecked={(v === "oui") === valeurs.stockNegatif}
              />
              <span>{l}</span>
            </label>
          ))}
          {c.stockNegatif && (
            <p className="text-danger text-sm">{c.stockNegatif}</p>
          )}
        </fieldset>
      </section>

      {etat.erreur && (
        <p role="alert" className="text-danger text-sm">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="text-success text-sm">
          {etat.succes}
        </p>
      )}
      <BoutonEnvoi enCours="Enregistrement…">
        Enregistrer les paramètres
      </BoutonEnvoi>
    </form>
  );
}
