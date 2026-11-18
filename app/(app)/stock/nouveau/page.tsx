import {
  FormulaireProduit,
  type ProduitInitial,
} from "@/components/stock/formulaire-produit";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireProduit } from "@/server/stock/lecture";

export const metadata = { title: "Nouveau produit · Kaya" };

export default async function PageNouveauProduit({
  searchParams,
}: {
  searchParams: Promise<{ copie?: string }>;
}) {
  const profil = await exigerRole("proprietaire");
  const { copie } = await searchParams;
  const supabase = await supabaseServeur();
  const [categories, marques, modele] = await Promise.all([
    supabase.from("categories").select("id, nom").order("nom"),
    supabase.from("marques").select("id, nom").order("nom"),
    copie && profil.boutiqueActiveId
      ? lireProduit(supabase, copie, profil.boutiqueActiveId)
      : null,
  ]);

  // « Dupliquer » : tout est copié (catégorie, marque, photo, unités, prix) sauf le stock et le code-barres. Le propriétaire modifie ce qu'il veut avant d'enregistrer.
  const initial: ProduitInitial = modele
    ? {
        nom: modele.nom,
        categorieId: modele.categorie_id,
        marqueId: modele.marque_id,
        imageCle: modele.image_cle,
        vignetteCle: modele.vignette_cle,
        uniteBase: modele.unite_base,
        seuilAlerte: String(modele.seuil_alerte),
        prixAchat: String(modele.prix_achat ?? 0),
        unites: modele.unites.map((u) => ({
          nom: u.nom,
          facteur: String(u.facteur),
          prixVente: String(u.prix_vente),
        })),
      }
    : {};

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">
        {modele ? `Dupliquer « ${modele.nom_affiche} »` : "Nouveau produit"}
      </h1>
      {modele && (
        <p className="text-muted mb-4">
          Tout est repris du produit d&apos;origine (le stock repart à 0). Changez le
          nom, la marque, les prix ou la photo : deux produits ne peuvent pas
          avoir exactement le même nom et la même marque.
        </p>
      )}
      <FormulaireProduit
        categories={categories.data ?? []}
        marques={marques.data ?? []}
        initial={initial}
      />
    </>
  );
}
