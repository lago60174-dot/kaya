import { FormulaireFournisseur } from "@/components/fournisseurs/formulaire-fournisseur";
import { exigerFournisseurs } from "@/server/fournisseurs/acces";

export const metadata = { title: "Nouveau fournisseur · Kaya" };

export default async function PageNouveauFournisseur() {
  await exigerFournisseurs();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Nouveau fournisseur</h1>
      <FormulaireFournisseur />
    </div>
  );
}
