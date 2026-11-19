import Link from "next/link";
import { EcranCommande } from "@/components/fournisseurs/ecran-commande";
import { supabaseServeur } from "@/lib/supabase/server";
import { versProduitsVente } from "@/lib/ventes/produits";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";
import { listerFournisseurs } from "@/server/fournisseurs/lecture";
import { listerProduits } from "@/server/stock/lecture";

export const metadata = { title: "Nouvelle commande · Kaya" };

export default async function PageNouvelleCommande({ searchParams }: { searchParams: Promise<{ fournisseur?: string }> }) {
  const { boutiqueId } = await exigerFournisseurs();
  const { fournisseur } = await searchParams;
  if (!boutiqueId) return <p>Aucune boutique n&apos;est associée à votre compte.</p>;
  const supabase = await supabaseServeur();
  const [fournisseurs, page] = await Promise.all([listerFournisseurs(supabase, boutiqueId), listerProduits(supabase, boutiqueId, {})]);
  if (fournisseurs.length === 0)
    return (
      <p className="bg-brand-soft max-w-xl rounded-lg p-4">
        Ajoutez d&apos;abord un fournisseur : <Link href="/fournisseurs/nouveau" className="font-semibold underline">nouveau fournisseur</Link>.
      </p>
    );
  return (
    <EcranCommande
      fournisseurs={fournisseurs.map((f) => ({ id: f.id, nom: f.nom }))}
      produitsInitiaux={versProduitsVente(page.produits)}
      fournisseurInitial={fournisseurs.some((f) => f.id === fournisseur) ? fournisseur : undefined}
    />
  );
}
