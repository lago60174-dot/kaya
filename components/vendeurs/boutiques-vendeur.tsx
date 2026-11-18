"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/auth/bouton-envoi";
import type { BoutiqueAccessible } from "@/lib/boutiques/active";
import {
  definirBoutiquesVendeurAction,
  type EtatVendeur,
} from "@/server/vendeurs/actions";
import { CasesBoutiques } from "./cases-boutiques";

export function BoutiquesVendeur({
  membreId,
  boutiques,
  attribuees,
}: {
  membreId: string;
  boutiques: BoutiqueAccessible[];
  attribuees: string[];
}) {
  const [etat, action] = useActionState<EtatVendeur, FormData>(
    definirBoutiquesVendeurAction,
    {},
  );
  const noms = boutiques.filter((b) => attribuees.includes(b.id)).map((b) => b.nom);
  return (
    <details className="text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center gap-1">
        <span className="text-muted">Boutiques :</span>
        <span className="font-semibold">{noms.length ? noms.join(", ") : "aucune"}</span>
        <span className="text-brand-strong ml-2 underline">Modifier</span>
      </summary>
      <form action={action} className="flex flex-col gap-3 pb-2">
        <input type="hidden" name="membreId" value={membreId} />
        <CasesBoutiques boutiques={boutiques} cochees={attribuees} idPrefixe={`v-${membreId}`} />
        {etat.erreur && <p role="alert" className="text-danger">{etat.erreur}</p>}
        {etat.succes && <p role="status" className="text-emerald-700">{etat.succes}</p>}
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
      </form>
    </details>
  );
}
