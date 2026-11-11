import { notFound } from "next/navigation";
import { FormulaireProduit } from "@/components/stock/formulaire-produit";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireProduit } from "@/server/stock/lecture";

export const metadata = { title: "Modifier le produit · Kaya" };

export default async function PageModifierProduit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profil = await exigerRole("proprietaire");
  const { id } = await params;
  const supabase = await supabaseServeur();
  const [produit, categories, marques] = await Promise.all([
    lireProduit(supabase, id, profil.boutiqueIds[0] ?? ""),
    supabase.from("categories").select("id, nom").order("nom"),
    supabase.from("marques").select("id, nom").order("nom"),
  ]);
  if (!produit) notFound();
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">
        Modifier « {produit.nom_affiche} »
      </h1>
      <FormulaireProduit
        categories={categories.data ?? []}
        marques={marques.data ?? []}
        initial={{
          id: produit.id,
          nom: produit.nom,
          categorieId: produit.categorie_id,
          marqueId: produit.marque_id,
          uniteBase: produit.unite_base,
          seuilAlerte: String(produit.seuil_alerte),
          prixAchat: String(produit.prix_achat ?? 0),
          actif: produit.actif,
          imageCle: produit.image_cle,
          vignetteCle: produit.vignette_cle,
          codeBarres: produit.code_barres,
          unites: produit.unites.map((u) => ({
            id: u.id,
            nom: u.nom,
            facteur: String(u.facteur),
            prixVente: String(u.prix_vente),
          })),
        }}
      />
    </>
  );
}
