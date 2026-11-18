/** Libellés et formats de l'administration. */
export const LIBELLE_STATUT: Record<string, string> = {
  en_attente: "En attente de paiement",
  essai: "Essai",
  actif: "Actif",
  en_retard: "En retard",
  suspendu: "Suspendu",
  annule: "Annulé",
};

export const COULEUR_STATUT: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-800",
  essai: "bg-sky-100 text-sky-800",
  actif: "bg-emerald-100 text-emerald-700",
  en_retard: "bg-orange-100 text-orange-700",
  suspendu: "bg-red-100 text-red-700",
  annule: "bg-gray-200 text-gray-700",
};

export const LIBELLE_ACTION: Record<string, string> = {
  paiement_manuel_enregistre: "Paiement manuel enregistré",
  facture_installation_creee: "Facture d'installation créée",
  plan_change: "Plan changé",
  plan_choisi: "Plan choisi par le propriétaire",
  plan_modifie: "Plan modifié (prix ou visibilité)",
  statut_suspendre: "Boutique suspendue",
  statut_reactiver: "Boutique réactivée",
  statut_annuler: "Abonnement annulé",
  demande_partenaire_acceptee: "Demande partenaire acceptée",
  demande_partenaire_refusee: "Demande partenaire refusée",
};

export const dateHeure = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(d))
    : "—";

export const dateSeule = (d: string | null) =>
  d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Douala" }).format(new Date(d)) : "—";
