"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import { Champ } from "@/components/auth/champ";
import { mouvementAction, type EtatStock } from "@/server/stock/actions";

const TITRES = {
  entree: "Entrée de stock",
  perte: "Perte ou casse",
  inventaire: "Inventaire (comptage)",
} as const;

interface Props {
  type: keyof typeof TITRES;
  produitId: string;
  uniteBase: string;
  unites: { id: string; nom: string }[];
}

export function FormulaireMouvement({
  type,
  produitId,
  uniteBase,
  unites,
}: Props) {
  const [etat, action] = useActionState<EtatStock, FormData>(
    mouvementAction,
    {},
  );
  const id = (n: string) => `${type}-${n}`;
  return (
    <form
      action={action}
      className="border-border flex flex-col gap-3 rounded-lg border p-3"
    >
      <h3 className="font-semibold">{TITRES[type]}</h3>
      <input type="hidden" name="produitId" value={produitId} />
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-col gap-1">
        <label htmlFor={id("unite")} className="text-sm font-medium">
          {type === "inventaire" ? "Compté en" : "Unité"}
        </label>
        <select
          id={id("unite")}
          name="uniteId"
          className="border-border min-h-11 rounded-lg border bg-white px-3 text-base"
          defaultValue=""
        >
          <option value="">{uniteBase} (unité de base)</option>
          {unites.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nom}
            </option>
          ))}
        </select>
      </div>
      <Champ
        nom="quantite"
        idChamp={id("quantite")}
        libelle={type === "inventaire" ? "Quantité comptée" : "Quantité"}
        inputMode="decimal"
        required
        erreur={etat.champs?.quantite}
      />
      <Champ
        nom="motif"
        idChamp={id("motif")}
        libelle={type === "perte" ? "Motif (obligatoire)" : "Note (facultatif)"}
        required={type === "perte"}
        erreur={etat.champs?.motif}
      />
      {type === "entree" && (
        <Champ
          nom="prixAchat"
          idChamp={id("prix")}
          libelle={`Nouveau prix d'achat par ${uniteBase} (facultatif)`}
          inputMode="numeric"
          erreur={etat.champs?.prixAchat}
        />
      )}
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
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}
