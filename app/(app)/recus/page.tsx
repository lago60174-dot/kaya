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
      <h1 className="text-2xl font-bold">Reçus</h1>
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
                className="border-border hover:bg-brand-soft flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{r.numero_recu}</span>
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
                  {r.statut === "annulee" && (
                    <span className="border-danger text-danger rounded-full border px-2 text-xs font-bold uppercase">
                      Annulé
                    </span>
                  )}
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
