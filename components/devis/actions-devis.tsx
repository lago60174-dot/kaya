"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PaiementsVente } from "@/components/vente/paiements-vente";
import { actionsPossibles, type StatutDevis } from "@/lib/devis/devis";
import { formatFcfa } from "@/lib/format";
import { preparerPaiements, type LignePaiement } from "@/lib/ventes/paiements";
import {
  convertirDevisAction,
  dupliquerDevisAction,
  marquerDevisAction,
  supprimerBrouillonAction,
} from "@/server/devis/actions";

const bouton =
  "flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-base font-semibold";

interface Props {
  devisId: string;
  statut: StatutDevis;
  /** Total que donnera la vente aux prix du jour (null : un article n'est plus en vente). */
  totalVente: number | null;
  /** Le devis a un client : le crédit est possible. */
  aUnClient: boolean;
}

/** Suite d'un devis : accepté ou refusé par le client, conversion en vente, duplication, suppression d'un brouillon. */
export function ActionsDevis({ devisId, statut, totalVente, aUnClient }: Props) {
  const router = useRouter();
  const peut = actionsPossibles(statut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [conversion, setConversion] = useState(false);
  const [credit, setCredit] = useState(false);
  const [paiements, setPaiements] = useState<LignePaiement[]>([{ mode: "especes", montant: "" }]);
  const [forcer, setForcer] = useState(false);
  const cleConversion = useRef(crypto.randomUUID());
  const cleCopie = useRef(crypto.randomUUID());

  async function executer(travail: () => Promise<{ ok: boolean; erreur?: string }>, apres: () => void) {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await travail();
      if (r.ok) {
        apres();
        return;
      }
      setErreur(r.erreur ?? "L'opération a échoué.");
    } catch {
      setErreur("Pas de connexion. Réessayez dans un instant.");
    }
    setOccupe(false);
  }

  const preparation =
    totalVente !== null ? preparerPaiements(paiements, credit, totalVente) : null;

  async function convertir() {
    if (!preparation?.ok) return;
    await executer(
      async () => {
        const r = await convertirDevisAction({
          devisId,
          cle: cleConversion.current,
          paiements: preparation.paiements,
          forcer: credit && forcer,
        });
        if (r.ok) router.push(`/vente/recu/${r.venteId}?succes=1`);
        return r.ok ? { ok: true } : r;
      },
      () => {},
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-2">
      {erreur && (
        <p role="alert" className="text-danger text-sm">{erreur}</p>
      )}
      {peut.accepter && (
        <button
          type="button"
          disabled={occupe}
          className={`${bouton} bg-success text-white`}
          onClick={() =>
            executer(() => marquerDevisAction(devisId, "accepte"), () => {
              router.refresh();
              setOccupe(false);
            })
          }
        >
          Le client a accepté
        </button>
      )}
      {peut.convertir && !conversion && (
        <button
          type="button"
          className={`${bouton} bg-brand-strong text-white`}
          onClick={() => setConversion(true)}
        >
          Convertir en vente
        </button>
      )}
      {peut.convertir && conversion && (
        <div className="border-border flex flex-col gap-3 rounded-2xl border bg-white p-3">
          {totalVente === null ? (
            <p role="alert" className="text-danger text-sm">
              Un article de ce devis n&apos;est plus en vente : la conversion est impossible.
              Dupliquez le devis pour le refaire.
            </p>
          ) : (
            <>
              <p className="font-semibold">Total de la vente : {formatFcfa(totalVente)}</p>
              <PaiementsVente
                lignes={paiements}
                onChange={setPaiements}
                credit={credit}
                onCredit={setCredit}
                total={totalVente}
                peutForcer
                forcer={forcer}
                onForcer={setForcer}
              />
              {credit && !aUnClient && (
                <p role="alert" className="text-danger text-sm">
                  Ce devis n&apos;a pas de client : le crédit n&apos;est pas possible.
                </p>
              )}
              {preparation && !preparation.ok && (
                <p role="alert" className="text-danger text-sm">{preparation.erreur}</p>
              )}
              <div className="flex gap-2">
                <button type="button" className={`${bouton} flex-1`} onClick={() => setConversion(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={convertir}
                  disabled={occupe || !preparation?.ok || (credit && !aUnClient)}
                  className={`${bouton} bg-brand-strong flex-1 text-white disabled:opacity-50`}
                >
                  {occupe ? "Enregistrement…" : "Valider la vente"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {peut.refuser && (
        <button
          type="button"
          disabled={occupe}
          className={bouton}
          onClick={() => {
            if (!window.confirm("Marquer ce devis comme refusé par le client ? Cette décision est définitive."))
              return;
            void executer(() => marquerDevisAction(devisId, "refuse"), () => {
              router.refresh();
              setOccupe(false);
            });
          }}
        >
          Le client a refusé
        </button>
      )}
      {peut.dupliquer && (
        <button
          type="button"
          disabled={occupe}
          className={bouton}
          onClick={() =>
            executer(
              async () => {
                const r = await dupliquerDevisAction(devisId, cleCopie.current);
                if (r.ok) router.push(`/devis/${r.devisId}/modifier`);
                return r.ok ? { ok: true } : r;
              },
              () => {},
            )
          }
        >
          Dupliquer en brouillon
        </button>
      )}
      {peut.supprimer && (
        <button
          type="button"
          disabled={occupe}
          className={`${bouton} text-danger`}
          onClick={() => {
            if (!window.confirm("Supprimer ce brouillon ?")) return;
            void executer(() => supprimerBrouillonAction(devisId), () => router.push("/devis"));
          }}
        >
          Supprimer ce brouillon
        </button>
      )}
    </div>
  );
}
