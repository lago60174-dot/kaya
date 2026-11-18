import { LIBELLE_ACTION, dateHeure } from "@/lib/admin";
import { supabaseServeur } from "@/lib/supabase/server";

export const metadata = { title: "Journal · Administration Kaya" };

export default async function PageJournalAdmin() {
  const { data } = await (await supabaseServeur())
    .from("journal_audit")
    .select("id, action, cible, details, cree_le")
    .order("id", { ascending: false })
    .limit(100);
  return (
    <>
      <h1 className="text-2xl font-bold">Journal</h1>
      <p className="text-muted">Les 100 dernières actions sensibles : paiements, changements de plan, statuts, partenaires.</p>
      <ul className="divide-border border-border divide-y rounded-2xl bg-white shadow-sm">
        {(data ?? []).length === 0 && <li className="text-muted p-4">Rien pour le moment.</li>}
        {(data ?? []).map((j) => (
          <li key={j.id as number} className="flex flex-col gap-0.5 p-3 text-sm">
            <b>{LIBELLE_ACTION[j.action as string] ?? (j.action as string)}</b>
            <span className="text-muted">
              {dateHeure(j.cree_le as string)}
              {j.cible ? ` · cible ${String(j.cible).slice(0, 8)}…` : ""}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
