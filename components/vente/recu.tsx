import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { libelleMode } from "@/lib/ventes/paiements";
import type { RecuDetail } from "@/server/ventes/lecture";

/** Reçu lisible sur téléphone. La classe `recu-imprimable` est la seule partie imprimée (voir globals.css). */
export function Recu({ recu }: { recu: RecuDetail }) {
  return (
    <article
      className="recu-imprimable border-border flex max-w-md flex-col gap-3 rounded-lg border bg-white p-4"
      aria-label={`Reçu ${recu.numeroRecu}`}
    >
      <header className="flex flex-col gap-1 text-center">
        <h2 className="text-lg font-bold">{recu.boutique.nom}</h2>
        {recu.boutique.adresse && (
          <p className="text-muted text-sm">{recu.boutique.adresse}</p>
        )}
        {recu.boutique.telephone && (
          <p className="text-muted text-sm">Tél. {recu.boutique.telephone}</p>
        )}
      </header>
      <div className="border-border flex items-start justify-between gap-2 border-y border-dashed py-2 text-sm">
        <div>
          <p className="font-semibold">Reçu {recu.numeroRecu}</p>
          <p className="text-muted">{formatDateHeure(recu.date)}</p>
          {recu.client && <p>Client : {recu.client.nom}</p>}
        </div>
        {recu.annule && (
          <p className="border-danger text-danger rounded border-2 px-2 py-1 text-sm font-bold uppercase">
            Annulé
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {recu.lignes.map((l, i) => (
          <li key={i} className="flex justify-between gap-2 text-sm">
            <span>
              {l.nom}
              <span className="text-muted block">
                {formatQuantite(l.quantite)} {l.unite} ×{" "}
                {formatFcfa(l.prixUnitaire)}
                {l.remiseLigne > 0 && ` (remise ${formatFcfa(l.remiseLigne)})`}
              </span>
            </span>
            <span className="shrink-0 font-medium">{formatFcfa(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="border-border flex flex-col gap-1 border-t border-dashed pt-2 text-sm">
        {recu.remise > 0 && (
          <div className="flex justify-between">
            <dt>Remise</dt>
            <dd>-{formatFcfa(recu.remise)}</dd>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold">
          <dt>Total</dt>
          <dd>{formatFcfa(recu.total)}</dd>
        </div>
        {recu.paiements.map((p, i) => (
          <div key={i} className="text-muted flex justify-between">
            <dt>{libelleMode(p.mode)}</dt>
            <dd>{formatFcfa(p.montant)}</dd>
          </div>
        ))}
        {recu.credit > 0 && (
          <div className="flex justify-between font-semibold">
            <dt>Reste à payer</dt>
            <dd>{formatFcfa(recu.credit)}</dd>
          </div>
        )}
      </dl>
      {recu.boutique.mentionLegale && (
        <p className="text-muted text-center text-xs">
          {recu.boutique.mentionLegale}
        </p>
      )}
    </article>
  );
}
