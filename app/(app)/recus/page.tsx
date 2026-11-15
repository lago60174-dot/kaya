import { FileText } from "lucide-react";
import Link from "next/link";
import { FiltresRecus } from "@/components/recus/filtres-recus";
import { formatDateHeure, formatFcfa } from "@/lib/format";
import { filtresDepuisParametres } from "@/lib/ventes/historique";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { listerRecus } from "@/server/ventes/lecture";

export const metadata = { title: "Reçus · Kaya" };

export default async function PageRecus({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profil = await exigerRole("boutique");
  const p = await searchParams;
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;

  const filtres = filtresDepuisParametres(p);
  const supabase = await supabaseServeur();
  const proprietaire = profil.role === "proprietaire";
  const [page, membres] = await Promise.all([
    listerRecus(supabase, boutiqueId, filtres),
    // Le filtre par vendeur n'existe que pour le propriétaire : la RLS ne montre que son propre compte au vendeur.
    proprietaire
      ? supabase
          .from("membres")
          .select("utilisateur_id, nom, role")
          .eq("actif", true)
      : null,
  ]);
  const vendeurs = (membres?.data ?? []).map((m) => ({
    id: m.utilisateur_id,
    nom: m.nom ?? (m.role === "proprietaire" ? "Propriétaire" : "Vendeur"),
  }));
  const filtre = Object.values({
    ...filtres,
    apresDate: undefined,
    apresId: undefined,
  }).some(Boolean);
  const suite = page.suivant
    ? new URLSearchParams({
        ...(p as Record<string, string>),
        apres_date: page.suivant.date,
        apres_id: page.suivant.id,
      })
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
          <FileText aria-hidden="true" size={26} />
        </span>
        <h1 className="text-xl font-bold">Mes reçus</h1>
      </div>
      <FiltresRecus vendeurs={vendeurs} />
      {page.recus.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          {filtre
            ? "Aucun reçu ne correspond à votre recherche."
            : "Aucun reçu pour le moment. Vos ventes apparaîtront ici."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {page.recus.map((r) => (
            <li key={r.id}>
              <Link
                href={`/vente/recu/${r.id}`}
                className="border-border hover:bg-brand-soft flex min-h-11 items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"
                >
                  <FileText size={22} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{r.numero_recu}</span>
                  <span className="text-muted truncate text-sm">
                    {formatDateHeure(r.date)}
                    {r.client_nom && ` · ${r.client_nom}`}
                    {r.vendeur_nom && ` · ${r.vendeur_nom}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={
                      r.statut === "annulee"
                        ? "text-muted font-semibold line-through"
                        : "font-semibold"
                    }
                  >
                    {formatFcfa(r.total)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${r.statut === "annulee" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                  >
                    {r.statut === "annulee" ? "Annulé" : "Validé"}
                  </span>
                  {r.statut === "valide" && r.credit > 0 && (
                    <span className="text-danger text-xs font-medium">
                      Reste {formatFcfa(r.credit)}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {suite && (
        <Link
          href={`/recus?${suite}`}
          className="border-border flex min-h-11 items-center justify-center rounded-lg border font-medium"
        >
          Voir la suite
        </Link>
      )}
    </div>
  );
}
