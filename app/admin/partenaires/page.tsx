import { BoutonsDemande } from "@/components/admin/formulaires";
import { dateHeure } from "@/lib/admin";
import { supabaseServeur } from "@/lib/supabase/server";

export const metadata = { title: "Partenaires · Administration Kaya" };

const carte = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm";

export default async function PagePartenaires() {
  const db = await supabaseServeur();
  const [demandes, affilies] = await Promise.all([
    db.from("demandes_partenaire").select("id, nom, telephone, mode_versement, statut, cree_le").order("cree_le", { ascending: false }).limit(100),
    db.from("affilies").select("id, nom, code, actif, telephone, cree_le").order("cree_le", { ascending: false }).limit(100),
  ]);
  const aValider = (demandes.data ?? []).filter((d) => d.statut === "a_valider");
  const traitees = (demandes.data ?? []).filter((d) => d.statut !== "a_valider");
  return (
    <>
      <h1 className="text-2xl font-bold">Partenaires</h1>
      <section aria-label="Demandes à valider" className={carte}>
        <h2 className="text-lg font-bold">Demandes à valider ({aValider.length})</h2>
        {aValider.length === 0 ? (
          <p className="text-muted">Aucune demande en attente.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {aValider.map((d) => (
              <li key={d.id as string} className="border-border flex flex-col gap-2 rounded-xl border p-3 text-sm">
                <span>
                  <b>{d.nom as string}</b> · {d.telephone as string} · versement {d.mode_versement === "mtn" ? "MTN MoMo" : "Orange Money"} ·{" "}
                  <span className="text-muted">{dateHeure(d.cree_le as string)}</span>
                </span>
                <BoutonsDemande id={d.id as string} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted text-sm">
          Accepter une demande ne crée pas encore le compte partenaire : contactez la personne, puis créez son compte à la main.
        </p>
      </section>
      <section aria-label="Partenaires actifs" className={carte}>
        <h2 className="text-lg font-bold">Partenaires ({(affilies.data ?? []).length})</h2>
        {(affilies.data ?? []).length === 0 ? (
          <p className="text-muted">Aucun partenaire pour le moment.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border text-sm">
            {(affilies.data ?? []).map((a) => (
              <li key={a.id as string} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  <b>{a.nom as string}</b> · code <code>{a.code as string}</code> · {(a.telephone as string) ?? "—"}
                </span>
                <span className="font-bold">{a.actif ? "Actif" : "Non validé"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {traitees.length > 0 && (
        <section aria-label="Demandes traitées" className={carte}>
          <h2 className="text-lg font-bold">Demandes traitées</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {traitees.map((d) => (
              <li key={d.id as string}>
                {d.nom as string} · {d.telephone as string} · <b>{d.statut === "acceptee" ? "acceptée" : "refusée"}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
