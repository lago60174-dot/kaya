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
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
        {produit.image_cle ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/img/${produit.image_cle}`}
            alt=""
            width={96}
            height={96}
            className="size-24 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-brand-soft text-brand-strong grid size-24 shrink-0 place-items-center rounded-xl text-3xl font-bold"
          >
            {produit.nom_affiche.charAt(0)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-bold">{produit.nom_affiche}</h1>
          {produit.unites[0] && (
            <p className="text-lg font-extrabold text-orange-600">
              {formatFcfa(produit.unites[0].prix_vente)}
            </p>
          )}
          <p
            className={`w-fit rounded-full px-3 py-0.5 text-sm font-bold ${bas ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}
          >
            {bas ? "Stock bas" : "Stock OK"}
          </p>
          {(produit.marques?.nom || !produit.actif) && (
            <p className="text-muted text-sm">
              {[produit.marques?.nom && `Marque ${produit.marques.nom}`, !produit.actif && "Hors vente"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      <section aria-label="Informations" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Informations</h2>
        <dl className="flex flex-col text-sm">
          {[
            ["Catégorie", produit.categories?.nom ?? "—"],
            ["Unité de base", produit.unite_base],
            ...(proprietaire && produit.prix_achat !== null
              ? [["Prix d'achat", `${formatFcfa(produit.prix_achat)} par ${produit.unite_base}`]]
              : []),
            ["Seuil d'alerte", `${formatQuantite(produit.seuil_alerte)} ${produit.unite_base}`],
          ].map(([terme, valeur]) => (
            <div key={terme} className="border-border flex justify-between gap-3 border-b py-2 last:border-0">
              <dt className="text-muted">{terme}</dt>
              <dd className="font-medium">{valeur}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="border-border flex flex-col gap-1 rounded-2xl border bg-white p-4 shadow-sm"
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

      <section aria-label="Prix de vente" className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Unités de vente</h2>
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
              className="border-border flex min-h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold"
            >
              Modifier
            </Link>
            <Link
              href={`/stock/nouveau?copie=${produit.id}`}
              className="border-border flex min-h-11 items-center rounded-full border bg-white px-4 text-sm font-semibold"
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
