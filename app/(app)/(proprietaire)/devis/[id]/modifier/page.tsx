import { notFound, redirect } from "next/navigation";
import { EcranDevis } from "@/components/devis/ecran-devis";
import { jourDouala } from "@/lib/devis/devis";
import { supabaseServeur } from "@/lib/supabase/server";
import type { LignePanier } from "@/lib/ventes/panier";
import { versProduitsVente } from "@/lib/ventes/produits";
import { exigerDevis } from "@/server/devis/acces";
import { lireDevis, lireProduitsDuDevis } from "@/server/devis/lecture";
import { listerProduits } from "@/server/stock/lecture";

export const metadata = { title: "Modifier le brouillon · Kaya" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PageModifierDevis({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { boutiqueId } = await exigerDevis();
  const { id } = await params;
  if (!UUID.test(id) || !boutiqueId) notFound();
  const supabase = await supabaseServeur();
  const devis = await lireDevis(supabase, id);
  if (!devis) notFound();
  // Un devis envoyé ne se modifie plus : on le duplique.
  if (devis.statut !== "brouillon") redirect(`/devis/${id}`);

  const [liste, produitsDuDevis] = await Promise.all([
    listerProduits(supabase, boutiqueId, {}),
    lireProduitsDuDevis(supabase, boutiqueId, [...new Set(devis.lignes.map((l) => l.produitId))]),
  ]);
  const parId = new Map(produitsDuDevis.map((p) => [p.id, p]));
  const lignes: LignePanier[] = [];
  for (const l of devis.lignes) {
    const produit = parId.get(l.produitId);
    // L'unité du brouillon est remplacée par la première disponible si elle n'existe plus.
    if (!produit || produit.unites.length === 0) continue;
    const uniteId = produit.unites.some((u) => u.id === l.uniteId)
      ? l.uniteId
      : produit.unites[0].id;
    lignes.push({ cle: crypto.randomUUID(), produit, uniteId, quantite: l.quantite, remiseLigne: 0 });
  }
  // Les produits du devis doivent aussi être proposés à la recherche.
  const catalogue = versProduitsVente(liste.produits);
  const connus = new Set(catalogue.map((p) => p.id));
  const produits = [...catalogue, ...produitsDuDevis.filter((p) => !connus.has(p.id))];

  return (
    <EcranDevis
      produitsInitiaux={produits}
      aujourdhui={jourDouala()}
      validiteDefaut={devis.valideJusqu}
      lignesPerdues={devis.lignes.length - lignes.length}
      initial={{
        id: devis.id,
        type: devis.type,
        client: devis.client,
        lignes,
        remise: devis.remise,
        valideJusqu: devis.valideJusqu < jourDouala() ? jourDouala() : devis.valideJusqu,
        conditions: devis.conditions ?? "",
        note: devis.note ?? "",
      }}
    />
  );
}
