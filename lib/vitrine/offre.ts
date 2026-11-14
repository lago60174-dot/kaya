import { formatFcfa } from "@/lib/format";
import { FONCTIONNALITES, peutUtiliser, limite, type Plan } from "@/lib/plans";

/** Une phrase simple par fonctionnalité de plan. Les fonctions communes à tous les plans sont décrites dans la page. */
const PHRASE_FONCTIONNALITE: Record<(typeof FONCTIONNALITES)[number], string> =
  {
    journal_complet: "Journal complet de toutes les actions, avec les alertes",
    devis: "Devis, proformas et bons de livraison",
    fournisseurs: "Fournisseurs, commandes et dettes fournisseurs",
    impression: "Impression sur ticket ou en A4",
    // Dit par la ligne « boutiques » (limite) : pas de doublon.
    multi_boutiques: "",
    resume_whatsapp: "Résumé de la journée sur WhatsApp, chaque soir",
  };

export function phraseVendeurs(max: number | null): string {
  if (max === null) return "Autant de vendeurs que vous voulez";
  if (max === 0) return "Vous seul vendez";
  return max === 1
    ? "1 vendeur, en plus de vous"
    : `${max} vendeurs, en plus de vous`;
}

export function phraseBoutiques(max: number | null): string {
  if (max === null) return "Plusieurs boutiques dans un seul compte";
  return max === 1 ? "1 boutique" : `${max} boutiques`;
}

/** Lignes affichées sous le prix d'un plan : limites, puis fonctions du plan. Tout vient de la base. */
export function lignesDuPlan(plan: Plan): string[] {
  const fonctions = FONCTIONNALITES.filter((f) => peutUtiliser(plan, f))
    .map((f) => PHRASE_FONCTIONNALITE[f])
    .filter((p) => p !== "");
  return [
    phraseVendeurs(limite(plan, "vendeurs")),
    phraseBoutiques(limite(plan, "boutiques")),
    ...fonctions,
  ];
}

export function prixParMois(plan: Plan): string {
  return `${formatFcfa(plan.prixMensuel)} par mois`;
}

function listeFrancaise(mots: string[]): string {
  if (mots.length <= 1) return mots.join("");
  return `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
}

/** Réponse de la FAQ sur l'imprimante : elle suit les plans visibles, sans promettre ce que l'offre affichée n'a pas. */
export function reponseImprimante(plansVisibles: Plan[]): string {
  const avec = plansVisibles
    .filter((p) => peutUtiliser(p, "impression"))
    .map((p) => p.nom);
  const base =
    "Non. À chaque vente, le client reçoit son reçu en PDF sur WhatsApp, depuis votre téléphone.";
  if (avec.length === 0) {
    return `${base} L'impression sur ticket n'est pas comprise dans l'offre actuelle.`;
  }
  const formule = avec.length > 1 ? "Les formules" : "La formule";
  const verbe = avec.length > 1 ? "permettent" : "permet";
  return `${base} ${formule} ${listeFrancaise(avec)} ${verbe} aussi d'imprimer sur un ticket de 58 mm ou en A4.`;
}

export interface ProgrammePublic {
  commissionPourcentage: number;
  dureeMois: number;
  seuilVersement: number;
  retentionJours: number;
  essaiJours: number;
}

export function programmeDepuisJson(brut: unknown): ProgrammePublic | null {
  if (typeof brut !== "object" || brut === null) return null;
  const j = brut as Record<string, unknown>;
  const nombre = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const p = {
    commissionPourcentage: nombre(j.commission_pourcentage),
    dureeMois: nombre(j.duree_mois),
    seuilVersement: nombre(j.seuil_versement),
    retentionJours: nombre(j.retention_jours),
    essaiJours: nombre(j.essai_jours),
  };
  return Object.values(p).every((v) => Number.isFinite(v)) ? p : null;
}

/** Données structurées SoftwareApplication. Les offres viennent des plans visibles uniquement. */
export function donneesStructurees(plans: Plan[], description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kaya",
    description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android",
    inLanguage: "fr",
    areaServed: { "@type": "Country", name: "Cameroun" },
    ...(plans.length > 0 && {
      offers: plans.map((p) => ({
        "@type": "Offer",
        name: p.nom,
        price: String(p.prixMensuel),
        priceCurrency: "XAF",
      })),
    }),
  };
}

/** JSON sûr à placer dans une balise <script> : « < » ne peut pas fermer la balise. */
export function jsonPourScript(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}
