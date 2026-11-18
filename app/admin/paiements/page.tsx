import Link from "next/link";
import { COULEUR_STATUT, dateHeure } from "@/lib/admin";
import { LIBELLE_STATUT_FACTURE } from "@/lib/abonnement/abonnement";
import { formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { listerBoutiques } from "@/server/admin/lecture";

export const metadata = { title: "Paiements · Administration Kaya" };

const carte = "flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm";

export default async function PagePaiements() {
  const db = await supabaseServeur();
  const [factures, erreurs, boutiques] = await Promise.all([
    db
      .from("factures_abonnement")
      .select("id, organisation_id, type, montant_brut, frais_paiement, statut, mode, payee_le, echeance, cree_le, mois_couverts")
      .order("cree_le", { ascending: false })
      .limit(100),
    db
      .from("evenements_paiement")
      .select("id, evenement_id, contenu, cree_le")
      .eq("statut_traitement", "erreur")
      .order("cree_le", { ascending: false })
      .limit(30),
    listerBoutiques(db, {}),
  ]);
  const noms = new Map((boutiques ?? []).map((b) => [b.id, b.nom]));
  const lignes = factures.data ?? [];
  return (
    <>
      <h1 className="text-2xl font-bold">Paiements</h1>
      {(erreurs.data ?? []).length > 0 && (
        <section aria-label="Paiements à revoir" className="flex flex-col gap-2 rounded-2xl bg-orange-50 p-4">
          <h2 className="text-lg font-bold">À revoir ({erreurs.data?.length})</h2>
          <p className="text-sm">
            Fapshi a signalé ces paiements mais ils n&apos;ont pas pu être rattachés à une facture (inconnue, annulée ou montant différent). Vérifiez dans
            Fapshi puis, si l&apos;argent est bien reçu, enregistrez le paiement à la main sur la fiche de la boutique.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {(erreurs.data ?? []).map((e) => {
              const c = (e.contenu ?? {}) as Record<string, unknown>;
              return (
                <li key={e.id as string}>
                  {dateHeure(e.cree_le as string)} · évènement <code>{String(e.evenement_id)}</code>
                  {c.amount !== undefined && <> · {formatFcfa(Number(c.amount))}</>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section aria-label="Factures récentes" className={carte}>
        <h2 className="text-lg font-bold">Factures récentes</h2>
        {lignes.length === 0 ? (
          <p className="text-muted">Aucune facture pour le moment.</p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-lg border">
            {lignes.map((f) => (
              <li key={f.id as string} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="flex flex-col">
                  <Link href={`/admin/boutiques/${f.organisation_id}`} className="font-bold underline">
                    {noms.get(f.organisation_id as string) ?? "Boutique"}
                  </Link>
                  <span className="text-muted">
                    {f.type === "installation" ? "Installation" : `Abonnement ${f.mois_couverts} mois`} · {f.mode === "manuel" ? "manuel" : "Fapshi"} ·{" "}
                    {f.payee_le ? `payée le ${dateHeure(f.payee_le as string)}` : `créée le ${dateHeure(f.cree_le as string)}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <b>{formatFcfa(Number(f.montant_brut))}</b>
                  <span className={`rounded-full px-3 py-0.5 font-bold ${COULEUR_STATUT[f.statut === "payee" ? "actif" : f.statut === "a_payer" ? "en_attente" : "annule"]}`}>
                    {LIBELLE_STATUT_FACTURE[f.statut as string] ?? f.statut}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
