import { OngletsFournisseurs } from "@/components/fournisseurs/onglets";
import { variationPrix } from "@/lib/fournisseurs/fournisseurs";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { listerChangementsPrix } from "@/server/fournisseurs/lecture";

export const metadata = { title: "Prix d'achat · Kaya" };

export default async function PagePrixAchat() {
  await exigerFournisseurs();
  const changements = await listerChangementsPrix(await supabaseServeur());
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Évolution des prix d&apos;achat</h1>
      <OngletsFournisseurs actif="/fournisseurs/prix" />
      <p className="text-muted text-sm">Prix par unité de base du produit (kg, barre, pièce…), à chaque réception où il a changé.</p>
      {changements.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">Aucun changement de prix pour le moment. Ils apparaissent à la réception d&apos;une commande.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {changements.map((h) => {
            const v = variationPrix(h.ancien, h.nouveau);
            const hausse = v !== null && v > 0;
            return (
              <li key={h.id} className="border-border flex items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-sm">
                <span className="min-w-0">
                  <span className="block font-bold">{h.produit}</span>
                  <span className="text-muted block truncate text-sm">
                    {formatDateHeure(h.date)}{h.fournisseur && ` · ${h.fournisseur}`}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm">
                    {h.ancien === null ? "Premier prix" : `${formatFcfa(h.ancien)} → `}
                    <b>{formatFcfa(h.nouveau)}</b> / {h.uniteBase}
                  </span>
                  {v !== null && v !== 0 && (
                    <span className={`text-xs font-bold ${hausse ? "text-danger" : "text-success"}`}>
                      {hausse ? "▲ Hausse" : "▼ Baisse"} de {Math.abs(v)} %
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
