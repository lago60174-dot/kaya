import { EcranVente } from "@/components/vente/ecran-vente";
import { supabaseServeur } from "@/lib/supabase/server";
import { versProduitsVente } from "@/lib/ventes/produits";
import { exigerRole } from "@/server/auth/session";
import { listerProduits } from "@/server/stock/lecture";

export const metadata = { title: "Vente · Kaya" };

export default async function PageVente() {
  const profil = await exigerRole("boutique");
  const boutiqueId = profil.boutiqueIds[0];
  if (
    !boutiqueId ||
    (profil.role !== "proprietaire" && profil.role !== "vendeur")
  ) {
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  }
  const supabase = await supabaseServeur();
  const [page, parametres] = await Promise.all([
    listerProduits(supabase, boutiqueId, {}),
    supabase
      .from("parametres_boutique")
      .select("seuil_remise_vendeur")
      .eq("boutique_id", boutiqueId)
      .maybeSingle(),
  ]);
  return (
    <EcranVente
      role={profil.role}
      seuilRemise={Number(parametres.data?.seuil_remise_vendeur ?? 5)}
      produitsInitiaux={versProduitsVente(page.produits)}
    />
  );
}
