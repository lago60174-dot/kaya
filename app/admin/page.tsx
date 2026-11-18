import Link from "next/link";
import { ActualisationAuto } from "@/components/admin/actualisation-auto";
import { formatFcfa } from "@/lib/format";
import { LIBELLE_STATUT } from "@/lib/admin";
import { supabaseServeur } from "@/lib/supabase/server";
import { lireResume } from "@/server/admin/lecture";

const carte = "flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm";

export default async function PageAdmin() {
  const r = await lireResume(await supabaseServeur());
  if (!r)
    return (
      <p role="alert" className="text-danger">
        Impossible de charger la vue d&apos;ensemble. Les migrations 20 et 21 sont-elles appliquées ?
      </p>
    );
  const kpis: [string, string, string?][] = [
    ["Boutiques", String(r.boutiques), `${r.inscrites7j} cette semaine · ${r.inscrites30j} en 30 jours`],
    ["Revenu mensuel estimé", formatFcfa(r.revenuMensuelEstime), "abonnements actifs × prix du plan"],
    ["Encaissé (30 jours)", formatFcfa(r.encaisse30j)],
    ["À encaisser", formatFcfa(r.aEncaisser), "factures ouvertes"],
    ["Boutiques actives", String(r.actives7j), `${r.ventes7j} ventes en 7 jours`],
  ];
  return (
    <>
      <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>
      <ActualisationAuto />
      {(r.paiementsARevoir > 0 || r.demandesPartenaire > 0) && (
        <section aria-label="À traiter" className="flex flex-col gap-2 rounded-2xl bg-orange-50 p-4">
          <h2 className="font-bold">À traiter</h2>
          {r.paiementsARevoir > 0 && (
            <p>
              <Link href="/admin/paiements" className="font-semibold underline">
                {r.paiementsARevoir} paiement{r.paiementsARevoir > 1 ? "s" : ""} à revoir
              </Link>{" "}
              (argent reçu mais non rattaché à une facture).
            </p>
          )}
          {r.demandesPartenaire > 0 && (
            <p>
              <Link href="/admin/partenaires" className="font-semibold underline">
                {r.demandesPartenaire} demande{r.demandesPartenaire > 1 ? "s" : ""} de partenaire
              </Link>{" "}
              à valider.
            </p>
          )}
        </section>
      )}
      <section aria-label="Chiffres" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map(([titre, valeur, aide]) => (
          <p key={titre} className={carte}>
            <span className="text-muted text-sm">{titre}</span>
            <b className="text-xl break-words">{valeur}</b>
            {aide && <span className="text-muted text-xs">{aide}</span>}
          </p>
        ))}
      </section>
      <section aria-label="Abonnements par statut" className={`${carte} gap-3`}>
        <h2 className="text-lg font-bold">Abonnements par statut</h2>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(LIBELLE_STATUT).map(([code, libelle]) => (
            <li key={code}>
              <Link
                href={`/admin/boutiques?statut=${code}`}
                className="border-border flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-orange-50"
              >
                {libelle} <b>{r.statuts[code] ?? 0}</b>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm">
          Par plan : {Object.entries(r.plans).map(([p, n]) => `${p} ${n}`).join(" · ") || "aucune boutique"}
        </p>
      </section>
    </>
  );
}
