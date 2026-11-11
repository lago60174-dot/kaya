import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiverProduit } from "@/components/stock/archiver";
import { FormulaireMouvement } from "@/components/stock/formulaire-mouvement";
import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import { formaterStock, margeUnite } from "@/lib/stock/quantites";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireProduit } from "@/server/stock/lecture";

export const metadata = { title: "Produit · Kaya" };

const TYPES: Record<string, string> = {
  entree: "Entrée",
  vente: "Vente",
  retour: "Retour",
  perte: "Perte",
  inventaire: "Inventaire",
  correction: "Correction",
};

export default async function PageProduit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profil = await exigerRole("boutique");
  const { id } = await params;
  const boutiqueId = profil.boutiqueIds[0] ?? "";
  const supabase = await supabaseServeur();
  const [produit, mouvements] = await Promise.all([
    lireProduit(supabase, id, boutiqueId),
    supabase
      .from("mouvements_stock")
      .select("id, type, quantite, motif, cree_le")
      .eq("produit_id", id)
      .eq("boutique_id", boutiqueId)
      .order("cree_le", { ascending: false })
      .limit(15),
  ]);
  if (!produit) notFound();
  const proprietaire = profil.role === "proprietaire";
  const bas = produit.stock < produit.seuil_alerte;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{produit.nom_affiche}</h1>
        <p className="text-muted">
          {[
            produit.categories?.nom,
            produit.marques?.nom && `Marque ${produit.marques.nom}`,
            !produit.actif && "Hors vente",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <section
        className="border-border flex flex-col gap-1 rounded-lg border p-3"
        aria-label="Stock"
      >
        <p className="text-muted text-sm">Stock actuel</p>
        <p className="text-xl font-semibold">
          {formaterStock(produit.stock, produit.unite_base, produit.unites)}
        </p>
        {bas && (
          <p className="text-danger text-sm font-semibold">
            Stock bas (alerte sous {formatQuantite(produit.seuil_alerte)}{" "}
            {produit.unite_base})
          </p>
        )}
      </section>

      <section aria-label="Prix de vente" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Prix de vente</h2>
        <ul className="flex flex-col gap-1">
          {produit.unites.map((u) => (
            <li
              key={u.id}
              className="border-border flex justify-between gap-2 border-b py-2"
            >
              <span>
                {u.nom}
                {u.facteur !== 1 && (
                  <span className="text-muted text-sm">
                    {" "}
                    ({formatQuantite(u.facteur)} {produit.unite_base})
                  </span>
                )}
              </span>
              <span className="text-right font-medium">
                {formatFcfa(u.prix_vente)}
                {proprietaire && produit.prix_achat !== null && (
                  <span className="text-muted block text-xs font-normal">
                    Marge{" "}
                    {formatFcfa(
                      margeUnite(u.prix_vente, u.facteur, produit.prix_achat),
                    )}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {proprietaire && produit.prix_achat !== null && (
          <p className="text-muted text-sm">
            Prix d&apos;achat : {formatFcfa(produit.prix_achat)} par{" "}
            {produit.unite_base}
          </p>
        )}
      </section>

      {proprietaire && (
        <>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/stock/${produit.id}/modifier`}
              className="border-border flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium"
            >
              Modifier
            </Link>
            <Link
              href={`/stock/nouveau?copie=${produit.id}`}
              className="border-border flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium"
            >
              Même produit, autre marque
            </Link>
          </div>
          <section
            aria-label="Mouvements de stock"
            className="flex flex-col gap-3"
          >
            <h2 className="text-lg font-semibold">Mouvements de stock</h2>
            {(["entree", "perte", "inventaire"] as const).map((t) => (
              <FormulaireMouvement
                key={t}
                type={t}
                produitId={produit.id}
                uniteBase={produit.unite_base}
                unites={produit.unites.map((u) => ({ id: u.id, nom: u.nom }))}
              />
            ))}
          </section>
        </>
      )}

      <section aria-label="Historique" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Derniers mouvements</h2>
        {(mouvements.data ?? []).length === 0 ? (
          <p className="text-muted">Aucun mouvement pour le moment.</p>
        ) : (
          <ul className="flex flex-col">
            {(mouvements.data ?? []).map((m) => (
              <li
                key={m.id}
                className="border-border flex justify-between gap-2 border-b py-2 text-sm"
              >
                <span>
                  {TYPES[m.type] ?? m.type}
                  {m.motif && <span className="text-muted"> · {m.motif}</span>}
                  <span className="text-muted block text-xs">
                    {formatDateHeure(m.cree_le)}
                  </span>
                </span>
                <span
                  className={
                    Number(m.quantite) < 0
                      ? "text-danger font-medium"
                      : "text-success font-medium"
                  }
                >
                  {Number(m.quantite) > 0 ? "+" : ""}
                  {formatQuantite(Number(m.quantite))} {produit.unite_base}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {proprietaire && <ArchiverProduit produitId={produit.id} />}
    </div>
  );
}
