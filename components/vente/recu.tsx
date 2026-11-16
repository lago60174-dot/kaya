import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { urlImage } from "@/server/images/cles";
import { libelleMode } from "@/lib/ventes/paiements";
import type { RecuAffichable } from "@/lib/ventes/recu";

/** Reçu lisible sur téléphone. La classe `recu-imprimable` est la seule partie imprimée (voir globals.css). */
export function Recu({ recu }: { recu: RecuAffichable }) {
  return (
    <article
      className="recu-imprimable border-border flex max-w-md flex-col gap-3 rounded-lg border bg-white p-4"
      aria-label={`Reçu ${recu.numeroRecu}`}
    >
      <header className="flex flex-col gap-1 text-center">
        {recu.boutique.logoCle && (
          // Logo déjà réduit à l'envoi (PNG, 300 px) et servi avec un cache long.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlImage(recu.boutique.logoCle)}
            alt=""
            className="mx-auto max-h-16 max-w-40 object-contain"
          />
        )}
        <h2 className="text-lg font-bold">{recu.boutique.nom}</h2>
        {recu.boutique.adresse && (
          <p className="text-muted text-sm">{recu.boutique.adresse}</p>
        )}
        {recu.boutique.telephone && (
          <p className="text-muted text-sm">Tél. {recu.boutique.telephone}</p>
        )}
        {[
          recu.boutique.ville,
          recu.boutique.email,
          recu.boutique.rccm && `RCCM : ${recu.boutique.rccm}`,
          recu.boutique.niu && `NIU : ${recu.boutique.niu}`,
        ]
          .filter(Boolean)
          .map((l) => (
            <p key={String(l)} className="text-muted text-xs">
              {l}
            </p>
          ))}
      </header>
      <div className="border-border flex items-start justify-between gap-2 border-y border-dashed py-2 text-sm">
        <div>
          <p className="font-semibold">Reçu {recu.numeroRecu}</p>
          <p className="text-muted">{formatDateHeure(recu.date)}</p>
          {recu.client && <p>Client : {recu.client.nom}</p>}
          {recu.vendeur && <p className="text-muted">Servi par : {recu.vendeur}</p>}
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
      {recu.annule && recu.avoir && (
        <p className="bg-brand-soft rounded p-2 text-sm">
          Avoir {recu.avoir.numero} · {formatDateHeure(recu.avoir.date)}
          <span className="text-muted block">Motif : {recu.avoir.motif}</span>
        </p>
      )}
      {(recu.boutique.signatureCle ||
        recu.boutique.cachetCle ||
        recu.boutique.signataire) && (
        <div className="flex flex-col items-center gap-1 pt-1">
          <p className="text-muted self-start text-xs">Signature et cachet</p>
          <div className="flex w-full items-end justify-around gap-3">
            {recu.boutique.signatureCle && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlImage(recu.boutique.signatureCle)}
                alt="Signature"
                className="max-h-14 max-w-[45%] object-contain"
              />
            )}
            {recu.boutique.cachetCle && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlImage(recu.boutique.cachetCle)}
                alt="Cachet"
                className="max-h-16 max-w-[45%] object-contain"
              />
            )}
          </div>
          {recu.boutique.signataire && (
            <p className="text-xs font-semibold">{recu.boutique.signataire}</p>
          )}
        </div>
      )}
      {recu.boutique.mentionLegale && (
        <p className="text-muted text-center text-xs">
          {recu.boutique.mentionLegale}
        </p>
      )}
    </article>
  );
}
