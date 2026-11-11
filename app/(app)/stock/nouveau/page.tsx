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
    copie && profil.boutiqueIds[0]
      ? lireProduit(supabase, copie, profil.boutiqueIds[0])
      : null,
  ]);

  // « Copier » : même produit dans une autre marque, sans refaire les conditionnements. Photo, stock et marque ne sont pas copiés.
  const initial: ProduitInitial = modele
    ? {
        nom: modele.nom,
        categorieId: modele.categorie_id,
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
        {modele ? `Même produit, autre marque` : "Nouveau produit"}
      </h1>
      {modele && (
        <p className="text-muted mb-4">
          Copié depuis « {modele.nom_affiche} ». Choisissez la nouvelle marque
          et ajustez les prix.
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
