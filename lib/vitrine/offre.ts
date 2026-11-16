import { formatFcfa } from "@/lib/format";
import { peutUtiliser, type Plan } from "@/lib/plans";

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
}

/** Totaux réels de la base, jamais saisis à la main. */
export interface ChiffresPublics {
  boutiques: number;
  ventes: number;
  montantVentes: number;
  produits: number;
  creditsRecouvres: number;
}

export function chiffresDepuisJson(brut: unknown): ChiffresPublics | null {
  if (typeof brut !== "object" || brut === null) return null;
  const j = brut as Record<string, unknown>;
  const n = (v: unknown) => Number(v);
  const c = {
    boutiques: n(j.boutiques),
    ventes: n(j.ventes),
    montantVentes: n(j.montant_ventes),
    produits: n(j.produits),
    creditsRecouvres: n(j.credits_recouvres),
  };
  return Object.values(c).every((v) => Number.isFinite(v) && v >= 0) ? c : null;
}

/**
 * Faut-il montrer les chiffres ? Seulement quand ils reposent sur un vrai usage (au moins une boutique
 * et quelques dizaines de ventes). Avant, la section reste masquée : jamais de chiffre ridicule ni inventé.
 */
export function chiffresAffichables(c: ChiffresPublics | null): c is ChiffresPublics {
  return c !== null && c.boutiques >= 1 && c.ventes >= 20;
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
