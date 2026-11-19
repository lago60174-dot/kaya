import { formatFcfa } from "@/lib/format";
import { limite, peutUtiliser, type Fonctionnalite, type Plan } from "@/lib/plans";

/**
 * Fonctions d'un plan qui ne sont pas encore livrées. Elles restent affichées (c'est la promesse de chaque formule)
 * mais portent la mention « Bientôt disponible ». Retirer une clé d'ici suffit quand la fonction est prête.
 */
export const FONCTIONS_BIENTOT: ReadonlySet<Fonctionnalite> = new Set([
]);

export interface LignePlan {
  texte: string;
  bientot: boolean;
}

const PHRASES: Record<Fonctionnalite, string> = {
  journal_complet: "Journal complet de toutes les actions, avec les alertes",
  devis: "Devis, proformas et bons de livraison",
  fournisseurs: "Fournisseurs, commandes et dettes fournisseurs",
  impression: "Impression sur ticket (58 mm) ou en A4",
  multi_boutiques: "Plusieurs boutiques dans un seul compte",
  resume_whatsapp: "Résumé de la journée sur WhatsApp, chaque soir",
};

/** Ordre d'affichage des fonctions de plan : les disponibles d'abord. */
const ORDRE: Fonctionnalite[] = [
  "journal_complet",
  "impression",
  "devis",
  "resume_whatsapp",
  "multi_boutiques",
];

export function phraseVendeurs(max: number | null): string {
  if (max === null) return "Autant de vendeurs que vous voulez";
  if (max === 0) return "Vous seul vendez";
  return max === 1 ? "1 vendeur, en plus de vous" : `${max} vendeurs, en plus de vous`;
}

export function phraseBoutiques(max: number | null): string {
  if (max === null) return "Boutiques illimitées";
  return max === 1 ? "1 boutique" : `${max} boutiques`;
}

/** Lignes sous le prix d'un plan : limites, puis fonctions du plan. Tout vient de la base ; seul « bientôt » est décidé ici. */
export function lignesPlan(plan: Plan): LignePlan[] {
  const lignes: LignePlan[] = [
    { texte: phraseVendeurs(limite(plan, "vendeurs")), bientot: false },
    {
      texte: phraseBoutiques(limite(plan, "boutiques")),
      bientot: false,
    },
  ];
  for (const f of ORDRE) {
    if (!peutUtiliser(plan, f) || f === "multi_boutiques") continue;
    lignes.push({ texte: PHRASES[f], bientot: FONCTIONS_BIENTOT.has(f) });
  }
  return lignes;
}

/** Ce que tous les plans incluent. Chaque élément est livré et utilisable aujourd'hui. */
export const INCLUS_PARTOUT: { titre: string; detail: string }[] = [
  { titre: "Stock", detail: "Fiches produits avec photo, unités de vente, seuils d'alerte et mouvements de stock." },
  { titre: "Ventes au comptoir", detail: "Vente rapide, remise, plusieurs modes de paiement dans une même vente." },
  { titre: "Reçus numérotés", detail: "PDF partagé sur WhatsApp, lien public, signature et cachet de la boutique." },
  { titre: "Crédits clients", detail: "Suivi de ce que chaque client vous doit, remboursements partiels et reçus de paiement." },
  { titre: "Caisse", detail: "Ouverture, dépenses, clôture et écart de caisse chaque jour." },
  { titre: "Tableau de bord et rapports", detail: "Ventes, marges et alertes de la boutique, sur la période de votre choix." },
  { titre: "Notifications", detail: "Alertes dans l'application et sur le téléphone, avec vos propres seuils." },
  { titre: "Vendeurs protégés", detail: "Votre vendeur ne voit jamais vos prix d'achat ni vos marges." },
  { titre: "Téléphone, iPhone et ordinateur", detail: "Rien à installer : un navigateur suffit, avec le même compte partout." },
];

export interface LigneComparatif {
  libelle: string;
  valeurs: Record<string, { texte: string; oui?: boolean; bientot?: boolean }>;
}

/** Tableau comparatif construit à partir des plans de la base. */
export function comparatif(plans: Plan[]): LigneComparatif[] {
  const par = (f: (p: Plan) => { texte: string; oui?: boolean; bientot?: boolean }) =>
    Object.fromEntries(plans.map((p) => [p.code, f(p)]));
  const fonction = (libelle: string, f: Fonctionnalite): LigneComparatif => ({
    libelle,
    valeurs: par((p) =>
      peutUtiliser(p, f)
        ? { texte: FONCTIONS_BIENTOT.has(f) ? "Bientôt disponible" : "Inclus", oui: true, bientot: FONCTIONS_BIENTOT.has(f) }
        : { texte: "Non inclus" },
    ),
  });
  return [
    { libelle: "Vendeurs", valeurs: par((p) => ({ texte: phraseVendeurs(limite(p, "vendeurs")) })) },
    {
      libelle: "Boutiques",
      valeurs: par((p) => {
        const max = limite(p, "boutiques");
        return { texte: phraseBoutiques(max), bientot: false };
      }),
    },
    fonction("Journal complet et alertes", "journal_complet"),
    fonction("Impression ticket 58 mm et A4", "impression"),
    fonction("Devis, proformas, bons de livraison", "devis"),
    fonction("Fournisseurs et dettes fournisseurs", "fournisseurs"),
    fonction("Résumé WhatsApp chaque soir", "resume_whatsapp"),
  ];
}

/** Prix d'une année payée d'un coup : 10 mois payés, 2 offerts (réglé avec l'équipe Kaya). */
export function prixAnnuel(plan: Plan): string {
  return formatFcfa(plan.prixMensuel * 10);
}
