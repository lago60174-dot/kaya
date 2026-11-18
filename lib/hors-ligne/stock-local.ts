import { formatFcfa } from "@/lib/format";
import { libelleMode } from "@/lib/ventes/paiements";
import { totalLigne, uniteDeLigne, type LignePanier, type ProduitVente } from "@/lib/ventes/panier";

/** Retire du stock affiché les quantités vendues sans réseau, pour ne pas vendre deux fois le même dernier article. Le serveur reste juge à l'envoi. */
export function retirerDuStock(produits: ProduitVente[], lignes: LignePanier[]): ProduitVente[] {
  const vendu = new Map<string, number>();
  for (const l of lignes) {
    const base = Math.round(l.quantite * uniteDeLigne(l).facteur * 1000) / 1000;
    vendu.set(l.produit.id, (vendu.get(l.produit.id) ?? 0) + base);
  }
  return produits.map((p) =>
    vendu.has(p.id) ? { ...p, stock: Math.round((p.stock - (vendu.get(p.id) ?? 0)) * 1000) / 1000 } : p,
  );
}

/** Texte à montrer ou partager au client en attendant le vrai reçu numéroté, créé à l'envoi de la vente. */
export function texteRecuProvisoire(
  lignes: LignePanier[],
  total: number,
  remise: number,
  paiements: { mode: string; montant?: number }[],
): string {
  // Un paiement sans montant prend le reste (règle de préparerPaiements) : total moins les montants saisis.
  const saisi = paiements.reduce((somme, p) => somme + (p.montant ?? 0), 0);
  const reste = Math.max(0, total - saisi);
  const date = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala", dateStyle: "short", timeStyle: "short" });
  return [
    "REÇU PROVISOIRE (le reçu numéroté sera envoyé dès que le réseau revient)",
    date,
    "",
    ...lignes.map((l) => `${l.quantite} x ${l.produit.nom} (${uniteDeLigne(l).nom}) : ${formatFcfa(totalLigne(l))}`),
    ...(remise > 0 ? [`Remise : ${formatFcfa(remise)}`] : []),
    `TOTAL : ${formatFcfa(total)}`,
    ...paiements.map((p) => `${libelleMode(p.mode)} : ${formatFcfa(p.montant ?? reste)}`),
  ].join("\n");
}
