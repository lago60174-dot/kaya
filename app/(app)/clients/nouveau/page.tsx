import { FormulaireClient } from "@/components/clients/formulaire-client";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";

export const metadata = { title: "Nouveau client · Kaya" };

export default async function PageNouveauClient() {
  const profil = await exigerRole("boutique");
  const { data } = await (
    await supabaseServeur()
  )
    .from("parametres_boutique")
    .select("plafond_credit_defaut")
    .eq("boutique_id", profil.boutiqueIds[0] ?? "")
    .maybeSingle();
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Nouveau client</h1>
      <FormulaireClient
        peutFixerPlafond={profil.role === "proprietaire"}
        plafondParDefaut={Number(data?.plafond_credit_defaut ?? 0)}
      />
    </>
  );
}
