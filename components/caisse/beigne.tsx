import { formatFcfa } from "@/lib/format";

export interface PartBeigne {
  libelle: string;
  montant: number;
  couleur: string;
}

/** Beigne des encaissements par mode, dessiné en SVG. La légende donne les mêmes chiffres en texte. */
export function Beigne({ parts }: { parts: PartBeigne[] }) {
  const total = parts.reduce((s, p) => s + p.montant, 0);
  const R = 40, C = 2 * Math.PI * R;
  let cumul = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 120 120" role="img" aria-label="Répartition des encaissements du jour" className="size-40 shrink-0">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#f1e8df" strokeWidth="18" />
        {total > 0 &&
          parts.filter((p) => p.montant > 0).map((p) => {
            const longueur = (p.montant / total) * C;
            const decalage = -cumul;
            cumul += longueur;
            return (
              <circle
                key={p.libelle}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={p.couleur}
                strokeWidth="18"
                strokeDasharray={`${longueur} ${C - longueur}`}
                strokeDashoffset={decalage}
                transform="rotate(-90 60 60)"
              />
            );
          })}
        <text x="60" y="58" textAnchor="middle" fontSize="13" fontWeight="800" fill="#17233d">
          {new Intl.NumberFormat("fr-FR").format(total)}
        </text>
        <text x="60" y="73" textAnchor="middle" fontSize="9" fill="#738094">
          FCFA
        </text>
      </svg>
      <ul className="flex min-w-48 flex-1 flex-col gap-2 text-sm">
        {parts.map((p) => (
          <li key={p.libelle} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: p.couleur }} />
            <span className="flex-1">{p.libelle}</span>
            <span className="text-muted w-10 text-right">{total > 0 ? Math.round((p.montant / total) * 100) : 0} %</span>
            <b className="w-28 text-right whitespace-nowrap">{formatFcfa(p.montant)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
