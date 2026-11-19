import { EcranDevis } from "@/components/devis/ecran-devis";
import {
  VALIDITE_DEFAUT_JOURS,
  ajouterJours,
  jourDouala,
} from "@/lib/devis/devis";
import { supabaseServeur } from "@/lib/supabase/server";
import { versProduitsVente } from "@/lib/ventes/produits";
import { exigerDevis } from "@/server/devis/acces";
import { listerProduits } from "@/server/stock/lecture";

export const metadata = { title: "Nouveau devis · Kaya" };

export default async function PageNouveauDevis({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { boutiqueId } = await exigerDevis();
  const { type } = await searchParams;
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const page = await listerProduits(await supabaseServeur(), boutiqueId, {});
  const aujourdhui = jourDouala();
  return (
    <EcranDevis
      produitsInitiaux={versProduitsVente(page.produits)}
      aujourdhui={aujourdhui}
      validiteDefaut={ajouterJours(aujourdhui, VALIDITE_DEFAUT_JOURS)}
      typeInitial={type === "proforma" ? "proforma" : "devis"}
    />
  );
}
