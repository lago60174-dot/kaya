import { formatFcfa } from "@/lib/format";

const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".", ",").replace(",0", "")}M`
    : n >= 1000
      ? `${Math.round(n / 1000)}k`
      : String(n);

const jourCourt = (jour: string, long: boolean) => {
  const d = new Date(`${jour}T12:00:00Z`);
  return long
    ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(d)
    : new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
};

type Point = { jour: string; total: number };

/** Une version du tracé, avec sa propre taille : le texte garde une taille lisible, du téléphone au grand écran. */
function Trace({ points, W, H, police, trait, id }: { points: Point[]; W: number; H: number; police: number; trait: number; id: string }) {
  const L = police * 4, R = 12, T = 12, B = police * 2.6;
  const max = Math.max(1, ...points.map((p) => p.total));
  const x = (i: number) => L + (points.length < 2 ? 0 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ligne = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.total).toFixed(1)}`).join(" ");
  const aire = `${ligne} L${x(points.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;
  const pas = Math.ceil(points.length / (W > 500 ? 12 : 7));
  const long = points.length > 7;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Courbe de l'évolution des ventes" className="h-auto w-full">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f26a0f" stopOpacity="0.28" />
          <stop offset="1" stopColor="#f26a0f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#eadfd5" strokeDasharray="3 4" />
          <text x={L - 6} y={y(max * f) + police / 3} textAnchor="end" fontSize={police} fill="#738094">
            {compact(Math.round(max * f))}
          </text>
        </g>
      ))}
      <path d={aire} fill={`url(#${id})`} />
      <path d={ligne} fill="none" stroke="#f26a0f" strokeWidth={trait} strokeLinejoin="round" />
      {points.length <= 14 &&
        points.map((p, i) => <circle key={p.jour} cx={x(i)} cy={y(p.total)} r={trait * 1.6} fill="#f26a0f" stroke="#fff" strokeWidth="1.5" />)}
      {points.map((p, i) =>
        i % pas === 0 || i === points.length - 1 ? (
          <text key={p.jour} x={x(i)} y={H - 8} textAnchor="middle" fontSize={police} fill="#738094">
            {jourCourt(p.jour, long)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Courbe des ventes par jour, dessinée en SVG (aucune librairie). Le tableau caché donne les mêmes chiffres aux lecteurs d'écran. */
export function CourbeVentes({ points }: { points: Point[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <div className="md:hidden">
        <Trace points={points} W={320} H={170} police={10} trait={2.5} id="aire-mobile" />
      </div>
      <div className="hidden md:block">
        <Trace points={points} W={900} H={260} police={13} trait={3} id="aire-bureau" />
      </div>
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.jour}>{jourCourt(p.jour, true)} : {formatFcfa(p.total)}</li>
        ))}
      </ul>
    </div>
  );
}
