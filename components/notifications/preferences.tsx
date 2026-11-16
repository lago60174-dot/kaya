"use client";

import { useState, useTransition } from "react";
import {
  ALERTES,
  CATEGORIES_ALERTE,
  canauxEffectifs,
  type Canaux,
  type Surcharges,
} from "@/lib/notifications/catalogue";
import { enregistrerPreferencesAction } from "@/server/notifications/actions";

const COLONNES: { cle: keyof Canaux; libelle: string; note?: string }[] = [
  { cle: "app", libelle: "Dans l'app" },
  { cle: "push", libelle: "Sur le téléphone" },
  { cle: "resume", libelle: "Résumé WhatsApp", note: "bientôt" },
];

/** Le propriétaire choisit, alerte par alerte, où il veut être prévenu. */
export function PreferencesNotifications({ valeurs }: { valeurs: Surcharges }) {
  const [choix, setChoix] = useState<Record<string, Canaux>>(() =>
    Object.fromEntries(ALERTES.map((a) => [a.type, canauxEffectifs(a.type, valeurs)])),
  );
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function basculer(type: string, cle: keyof Canaux) {
    setRetour(null);
    setChoix((c) => ({ ...c, [type]: { ...c[type], [cle]: !c[type][cle] } }));
  }

  function enregistrer() {
    demarrer(async () => {
      const r = await enregistrerPreferencesAction(choix);
      setRetour(
        r.erreur
          ? { ok: false, texte: r.erreur }
          : { ok: true, texte: r.succes ?? "Enregistré." },
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {CATEGORIES_ALERTE.map((cat) => (
        <fieldset key={cat.code} className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">{cat.libelle}</legend>
          {ALERTES.filter((a) => a.categorie === cat.code).map((a) => (
            <div key={a.type} className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">
                  {a.libelle}
                  {a.critique && (
                    <span className="bg-danger/10 text-danger ml-2 rounded px-1.5 py-0.5 text-xs font-semibold">
                      Critique
                    </span>
                  )}
                </p>
                <p className="text-muted text-sm">{a.aide}</p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {COLONNES.map((col) => (
                  <label key={col.cle} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={choix[a.type][col.cle]}
                      onChange={() => basculer(a.type, col.cle)}
                      className="size-5"
                    />
                    <span>
                      {col.libelle}
                      {col.note && <span className="text-muted"> ({col.note})</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
      <button
        type="button"
        onClick={enregistrer}
        disabled={enCours}
        className="bg-brand-strong flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold text-white"
      >
        {enCours ? "Enregistrement…" : "Enregistrer mes choix"}
      </button>
      {retour && (
        <p role={retour.ok ? "status" : "alert"} className={retour.ok ? "text-success text-sm" : "text-danger text-sm"}>
          {retour.texte}
        </p>
      )}
    </div>
  );
}
