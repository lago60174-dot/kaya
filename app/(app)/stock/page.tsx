import Link from "next/link";
import { FiltresStock } from "@/components/stock/filtres-stock";
import { formatFcfa } from "@/lib/format";
import { formaterStock } from "@/lib/stock/quantites";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { listerProduits } from "@/server/stock/lecture";

export const metadata = { title: "Stock · Kaya" };

type Recherche = Promise<Record<string, string | undefined>>;

export default async function PageStock({
  searchParams,
}: {
  searchParams: Recherche;
}) {
  const profil = await exigerRole("boutique");
  const p = await searchParams;
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;

  const supabase = await supabaseServeur();
  const [page, categories, marques] = await Promise.all([
    listerProduits(supabase, boutiqueId, {
      recherche: p.q,
      categorie: p.categorie,
      marque: p.marque,
      stockBas: p.bas === "1",
      apresNom: p.apres_nom,
      apresId: p.apres_id,
    }),
    supabase.from("categories").select("id, nom").order("nom"),
    supabase.from("marques").select("id, nom").order("nom"),
  ]);
  const proprietaire = profil.role === "proprietaire";
  const filtre = Boolean(p.q || p.categorie || p.marque || p.bas);

  const suite = page.suivant
    ? new URLSearchParams({
        ...(p as Record<string, string>),
        apres_nom: page.suivant.nom,
        apres_id: page.suivant.id,
      })
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Stock</h1>
        {proprietaire && (
          <Link
            href="/stock/nouveau"
            className="bg-brand-strong flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
          >
            Ajouter un produit
          </Link>
        )}
      </div>
      <FiltresStock
        categories={categories.data ?? []}
        marques={marques.data ?? []}
      />
      {page.produits.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          {filtre
            ? "Aucun produit ne correspond à votre recherche."
            : proprietaire
              ? "Aucun produit. Ajoutez votre premier article."
              : "Aucun produit pour le moment."}
        </p>
      ) : (
        <ul className="kaya-stock-grid flex flex-col gap-2">
          {page.produits.map((l) => (
            <li key={l.id}>
              <Link
                href={`/stock/${l.id}`}
                className="border-border hover:bg-brand-soft flex min-h-11 items-center gap-3 rounded-lg border p-3"
              >
                {l.vignette_cle ? (
                  // Vignette WebP de 200 px, chargée à la demande.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/img/${l.vignette_cle}`}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    className="size-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="bg-brand-soft text-brand-strong grid size-12 shrink-0 place-items-center rounded-md font-semibold"
                  >
                    {l.nom_affiche.charAt(0)}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{l.nom_affiche}</span>
                  <span className="text-muted text-sm">
                    {formaterStock(
                      Number(l.stock),
                      l.unite_base,
                      l.unites.map((u) => ({
                        nom: u.nom,
                        facteur: Number(u.facteur),
                      })),
                    )}
                  </span>
                  <span className="text-muted text-sm">
                    {l.unites
                      .slice(0, 2)
                      .map(
                        (u) => `${formatFcfa(Number(u.prix_vente))} / ${u.nom}`,
                      )
                      .join(" · ")}
                  </span>
                </span>
                {l.stock_bas && (
                  <span className="bg-danger shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-white">
                    Stock bas
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {suite && (
        <Link
          href={`/stock?${suite}`}
          className="border-border flex min-h-11 items-center justify-center rounded-lg border font-medium"
        >
          Voir la suite
        </Link>
      )}
    </div>
  );
}
