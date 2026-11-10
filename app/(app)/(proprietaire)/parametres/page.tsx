import { ActionsVendeur } from "@/components/vendeurs/actions-vendeur";
import { FormulaireVendeur } from "@/components/vendeurs/formulaire-vendeur";
import { limite } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";

export const metadata = { title: "Paramètres · Kaya" };

export default async function PageParametres() {
  const profil = await exigerRole("proprietaire");
  const supabase = await supabaseServeur();
  const { data: vendeurs } = await supabase
    .from("membres")
    .select("id, nom, actif")
    .eq("role", "vendeur")
    .order("cree_le");
  const max = profil.plan ? limite(profil.plan, "vendeurs") : 0;
  const actifs = (vendeurs ?? []).filter((v) => v.actif).length;
  const peutAjouter = max === null || actifs < max;

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <h1 className="text-2xl font-bold">Paramètres</h1>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Mes vendeurs</h2>
        {(vendeurs ?? []).length === 0 ? (
          <p className="text-muted">
            Aucun vendeur. Créez le premier compte ci-dessous.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {(vendeurs ?? []).map((v) => (
              <li key={v.id} className="border-border rounded-lg border p-3">
                <p className="font-medium">
                  {v.nom ?? "Vendeur"}{" "}
                  {!v.actif && (
                    <span className="text-muted text-sm">(désactivé)</span>
                  )}
                </p>
                <ActionsVendeur membreId={v.id} actif={v.actif} />
              </li>
            ))}
          </ul>
        )}
        {peutAjouter ? (
          <FormulaireVendeur />
        ) : (
          <p className="bg-brand-soft rounded-lg p-3 text-sm">
            Votre abonnement permet {max} vendeur
            {max !== null && max > 1 ? "s" : ""} actif
            {max !== null && max > 1 ? "s" : ""}. Désactivez un vendeur pour en
            ajouter un autre.
          </p>
        )}
      </section>
    </div>
  );
}
