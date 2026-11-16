import { AssistantCatalogue } from "@/components/catalogue/assistant-catalogue";
import { CATALOGUE, nomRecherche } from "@/lib/catalogue";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";

export const metadata = { title: "Catalogue de démarrage · Kaya" };

export default async function PageDemarrage() {
  const profil = await exigerRole("proprietaire");
  const supabase = await supabaseServeur();
  const { data } = await supabase
    .from("produits")
    .select("nom_recherche")
    .is("archive_le", null)
    .limit(5000);
  const presents = new Set((data ?? []).map((p) => p.nom_recherche as string));
  const dejaPresents = CATALOGUE.filter((p) =>
    presents.has(nomRecherche(p)),
  ).map((p) => p.ref);

  return (
    <AssistantCatalogue
      produits={CATALOGUE}
      dejaPresents={dejaPresents}
      cleBrouillon={`kaya:catalogue:${profil.organisationId}`}
      premiereFois={presents.size === 0}
    />
  );
}
