import Link from "next/link";
import { Banknote, Boxes, ShoppingBag, Store, Users } from "lucide-react";
import { MiseAJourDirecte } from "@/components/patron/mise-a-jour-directe";
import { SelecteurVue } from "@/components/patron/selecteur-vue";
import { formatFcfa } from "@/lib/format";
import { totaliser, type LigneConsolidee } from "@/lib/patron/consolide";
import { variationVsHier } from "@/lib/patron/direct";

const carte =
  "kaya-kpi flex flex-col items-center gap-1 rounded-2xl border-0 p-4 text-center";

/** Vue d'ensemble de toutes les boutiques du propriétaire : totaux du jour, puis une carte par boutique. */
export function VueConsolidee({
  lignes,
  organisationId,
  nom,
}: {
  lignes: LigneConsolidee[];
  organisationId: string;
  nom: string | null;
}) {
  const t = totaliser(lignes);
  const variation = variationVsHier(t.ventesTotal, t.ventesHier);
  return (
    <div className="kaya-dashboard flex max-w-3xl flex-col gap-6">
      <header className="kaya-dashboard-header flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <Store aria-hidden="true" size={30} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">Toutes mes boutiques</h1>
            <p className="text-muted text-sm">
              Bonjour{nom ? ` ${nom}` : ""} · {lignes.length} boutiques
            </p>
          </div>
        </div>
        <SelecteurVue
          boutiques={lignes.map((l) => ({ id: l.boutiqueId, nom: l.nom }))}
          valeur="toutes"
        />
        <MiseAJourDirecte organisationId={organisationId} />
      </header>

      <section aria-label="Chiffres du jour, toutes boutiques" className="kaya-dashboard-kpis grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={carte} style={{ background: "linear-gradient(180deg,#ff8b1a,#f26a0f)", color: "#fff" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-white/25 text-white"><ShoppingBag size={20} /></span>
          <p className="text-sm text-white">Ventes du jour ({t.nbVentes} vente{t.nbVentes > 1 ? "s" : ""})</p>
          <p className="text-xl font-extrabold break-words">{formatFcfa(t.ventesTotal)}</p>
          <p className="text-sm text-white">
            Hier : {formatFcfa(t.ventesHier)}
            {variation !== null && ` (${variation > 0 ? "+" : ""}${variation} %)`}
          </p>
        </div>
        <div className={carte} style={{ background: "#dff4e7" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Banknote size={20} /></span>
          <p className="text-muted text-sm">Espèces attendues (total)</p>
          <p className="text-xl font-extrabold break-words">{formatFcfa(t.especesAttendues)}</p>
          <p className="text-muted text-sm">Mobile Money : {formatFcfa(t.mobileMoney)}</p>
        </div>
        <div className={carte} style={{ background: "#e4edff" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-blue-100 text-blue-700"><Users size={20} /></span>
          <p className="text-muted text-sm">Ce que les clients vous doivent</p>
          <p className="text-xl font-extrabold break-words">{formatFcfa(t.dettesTotal)}</p>
        </div>
        <div className={carte} style={{ background: "#fde9da" }}>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><Boxes size={20} /></span>
          <p className="text-muted text-sm">Produits en stock bas (toutes boutiques)</p>
          <p className={`text-xl font-extrabold break-words ${t.stockBas > 0 ? "text-danger" : ""}`}>{t.stockBas}</p>
          <p className="text-muted text-sm">Dépenses du jour : {formatFcfa(t.depensesTotal)}</p>
        </div>
      </section>

      <section aria-label="Détail par boutique" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Boutique par boutique</h2>
        <ul className="flex flex-col gap-3">
          {lignes.map((l) => (
            <li key={l.boutiqueId} className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-bold">{l.nom}</p>
                <p className="font-extrabold whitespace-nowrap">{formatFcfa(l.ventesTotal)}</p>
              </div>
              <p className="text-muted text-sm">
                {l.nbVentes} vente{l.nbVentes > 1 ? "s" : ""} · espèces attendues {formatFcfa(l.especesAttendues)} · dettes {formatFcfa(l.dettesTotal)} · stock bas {l.stockBas}
              </p>
              <p className="flex flex-wrap gap-2 text-xs font-semibold">
                {l.cloturesAValider > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
                    {l.cloturesAValider} caisse{l.cloturesAValider > 1 ? "s" : ""} à valider
                  </span>
                )}
                {!l.enEcriture && (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Lecture seule</span>
                )}
              </p>
              <Link href={`/patron?boutique=${l.boutiqueId}`} className="text-sm font-bold text-orange-600">
                Voir le détail de cette boutique →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
