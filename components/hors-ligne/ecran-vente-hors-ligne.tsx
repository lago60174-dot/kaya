"use client";

import { useEffect, useState } from "react";
import { FormulaireDepense } from "@/components/caisse/formulaire-depense";
import { EcranVente } from "@/components/vente/ecran-vente";
import { lireCatalogue, type Catalogue } from "@/lib/hors-ligne/stockage";

/** Écran de vente servi sans réseau : les produits viennent de la mémoire de l'appareil. */
export function EcranVenteHorsLigne() {
  const [etat, setEtat] = useState<"chargement" | "vide" | Catalogue>("chargement");
  const [onglet, setOnglet] = useState<"vente" | "depense">("vente");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("onglet") === "depense")
      void Promise.resolve().then(() => setOnglet("depense"));
    lireCatalogue()
      .then((c) => setEtat(c ?? "vide"))
      .catch(() => setEtat("vide"));
  }, []);
  if (etat === "chargement") return <p>Chargement…</p>;
  if (etat === "vide")
    return (
      <p className="rounded-xl bg-orange-50 p-4">
        Le mode hors ligne n&apos;est pas encore prêt sur cet appareil. Ouvrez l&apos;écran Vente une fois avec Internet : Kaya garde alors vos produits pour la prochaine coupure.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">
        Produits enregistrés le {new Date(etat.enregistreLe).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}. Les stocks affichés peuvent avoir changé : le serveur vérifie chaque vente à son envoi.
      </p>
      <div role="tablist" aria-label="Que faire sans connexion ?" className="flex gap-2">
        {([["vente", "Vendre"], ["depense", "Dépense"]] as const).map(([code, libelle]) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={onglet === code}
            onClick={() => setOnglet(code)}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-bold ${onglet === code ? "bg-orange-500 text-white" : "border-border border bg-white"}`}
          >
            {libelle}
          </button>
        ))}
      </div>
      {onglet === "vente" ? (
        <EcranVente role={etat.role} seuilRemise={etat.seuilRemise} produitsInitiaux={etat.produits} boutiqueId={etat.boutiqueId} />
      ) : (
        <FormulaireDepense role={etat.role} boutiqueId={etat.boutiqueId} />
      )}
    </div>
  );
}
