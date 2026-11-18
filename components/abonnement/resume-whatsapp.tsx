"use client";

import { useActionState } from "react";
import { reglerResumeAction, type EtatResume } from "@/server/abonnement/actions";

export function ResumeWhatsapp({ actif, inclus }: { actif: boolean; inclus: boolean }) {
  const [etat, action, enCours] = useActionState<EtatResume, FormData>(reglerResumeAction, {});
  const estActif = etat.ok ? etat.ok.includes("activé") && !etat.ok.includes("désactivé") : actif;
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">Résumé WhatsApp du soir</h2>
      <p className="text-muted text-sm">
        Chaque soir, recevez sur WhatsApp (au numéro de votre inscription) vos ventes du jour, votre produit le plus vendu, les produits en stock bas et les crédits
        clients à recouvrer.
      </p>
      {!inclus ? (
        <p className="bg-brand-soft rounded-lg p-3 text-sm">Le résumé WhatsApp est inclus dans le plan Pro.</p>
      ) : (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="actif" value={estActif ? "0" : "1"} />
          <p className="text-sm font-medium">{estActif ? "Activé" : "Désactivé"}</p>
          {etat.erreur && (
            <p role="alert" className="text-danger text-sm">
              {etat.erreur}
            </p>
          )}
          {etat.ok && (
            <p role="status" className="text-sm font-medium text-emerald-700">
              {etat.ok}
            </p>
          )}
          <button
            type="submit"
            disabled={enCours}
            className={`min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${estActif ? "border-border border bg-white" : "bg-brand-strong text-white"}`}
          >
            {enCours ? "Un instant…" : estActif ? "Désactiver" : "Activer le résumé"}
          </button>
        </form>
      )}
    </section>
  );
}
