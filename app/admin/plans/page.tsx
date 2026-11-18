import { FormulaireModifierPlan } from "@/components/admin/formulaires";
import { supabaseServeur } from "@/lib/supabase/server";

export const metadata = { title: "Plans · Administration Kaya" };

export default async function PagePlans() {
  const { data } = await (await supabaseServeur()).from("plans").select("code, nom, prix_mensuel, visible_public").order("ordre");
  return (
    <>
      <h1 className="text-2xl font-bold">Plans</h1>
      <p className="text-muted">
        Le prix s&apos;applique aux prochaines factures : celles déjà créées ne changent pas. Un plan masqué n&apos;apparaît ni sur le site ni à l&apos;inscription.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {(data ?? []).map((p) => (
          <FormulaireModifierPlan key={p.code as string} code={p.code as string} nom={p.nom as string} prix={Number(p.prix_mensuel)} visible={Boolean(p.visible_public)} />
        ))}
      </div>
    </>
  );
}
