import { formatDateHeure, formatFcfa } from "@/lib/format";
import { libelleMode } from "@/lib/ventes/paiements";
import type { PaiementCreditDetail } from "@/server/clients/lecture";

/** Reçu d'un paiement de crédit. Même classe d'impression que le reçu de vente. */
export function RecuPaiement({ p }: { p: PaiementCreditDetail }) {
  return (
    <article
      className="recu-imprimable border-border flex max-w-md flex-col gap-3 rounded-lg border bg-white p-4"
      aria-label={`Reçu de paiement ${p.numero}`}
    >
      <header className="flex flex-col gap-1 text-center">
        <h2 className="text-lg font-bold">{p.boutique}</h2>
        {p.boutiqueAdresse && (
          <p className="text-muted text-sm">{p.boutiqueAdresse}</p>
        )}
      </header>
      <div className="border-border border-y border-dashed py-2 text-sm">
        <p className="font-semibold">Reçu de paiement {p.numero}</p>
        <p className="text-muted">{formatDateHeure(p.date)}</p>
        <p>Client : {p.client}</p>
      </div>
      <p className="text-center text-2xl font-bold">{formatFcfa(p.montant)}</p>
      <p className="text-muted text-center text-sm">
        Payé par {libelleMode(p.mode)}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {p.repartition.map((r, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span>{r.numeroRecuVente}</span>
            <span>
              {formatFcfa(r.montant)}{" "}
              <span className="text-muted">
                {r.soldeApres === 0
                  ? "(soldé)"
                  : `(reste ${formatFcfa(r.soldeApres)})`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-border border-t border-dashed pt-2 text-center font-semibold">
        {p.detteRestante > 0
          ? `Reste à payer : ${formatFcfa(p.detteRestante)}`
          : "Le client ne doit plus rien. Merci !"}
      </p>
    </article>
  );
}
