"use client";

import { Settings, Store } from "lucide-react";
import { useActionState, useState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import {
  enregistrerParametresAction,
  type EtatParametres,
} from "@/server/parametres/actions";
import type { ParametresLus } from "@/server/parametres/lecture";

const carte = "flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm";

/** Boutique (nom, contact, pied de reçu) et règles de gestion : deux cartes côte à côte, enregistrées ensemble. */
export function FormulaireParametres({ valeurs }: { valeurs: ParametresLus }) {
  const [etat, action] = useActionState<EtatParametres, FormData>(
    enregistrerParametresAction,
    {},
  );
  const [negatif, setNegatif] = useState(valeurs.stockNegatif);
  const c = etat.champs ?? {};
  return (
    <form action={action} className="grid items-start gap-5 lg:grid-cols-2">
      <section className={carte}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Store aria-hidden="true" size={22} className="text-orange-600" />
          Informations de la boutique
        </h2>
        <Champ nom="nom" libelle="Nom de la boutique" required defaultValue={valeurs.nom} erreur={c.nom} />
        <Champ nom="adresse" libelle="Adresse" defaultValue={valeurs.adresse} erreur={c.adresse} />
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
            Pied de reçu
          </label>
          <textarea
            id="mentionLegale"
            name="mentionLegale"
            rows={3}
            maxLength={300}
            defaultValue={valeurs.mentionLegale}
            aria-invalid={c.mentionLegale ? true : undefined}
            className="border-border focus:border-brand-strong focus:outline-brand rounded-xl border bg-white px-3 py-2 text-base focus:outline-2"
          />
          <p className={c.mentionLegale ? "text-danger text-sm" : "text-muted text-sm"}>
            {c.mentionLegale ?? "Par exemple : « Merci de votre confiance. Échange sous 7 jours avec le reçu. »"}
          </p>
        </div>
      </section>

      <section className={carte}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Settings aria-hidden="true" size={22} className="text-orange-600" />
          Paramètres de gestion
        </h2>
        <Champ
          nom="seuilRemise"
          libelle="Seuil de remise du vendeur (%)"
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <p id="lib-stock-negatif" className="text-sm font-medium">
              Autoriser le stock négatif
            </p>
            <p className="text-muted text-sm">
              {negatif
                ? "Oui : on peut vendre sans stock (une alerte est créée)."
                : "Non : la vente est refusée si le stock manque."}
            </p>
          </div>
          <input type="hidden" name="stockNegatif" value={negatif ? "oui" : "non"} />
          <button
            type="button"
            role="switch"
            aria-checked={negatif}
            aria-labelledby="lib-stock-negatif"
            onClick={() => setNegatif(!negatif)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${negatif ? "bg-emerald-500" : "bg-slate-300"}`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${negatif ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
        {c.stockNegatif && <p className="text-danger text-sm">{c.stockNegatif}</p>}
        <Champ
          nom="ecartTolere"
          libelle="Écart de caisse toléré (FCFA)"
          inputMode="numeric"
          required
          defaultValue={String(valeurs.ecartTolere)}
          erreur={c.ecartTolere}
          aide="Un écart plus grand à la clôture déclenche une alerte."
        />
      </section>

      <div className="flex flex-col gap-3 lg:col-span-2">
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
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer les paramètres</BoutonEnvoi>
      </div>
    </form>
  );
}
