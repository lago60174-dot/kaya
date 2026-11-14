import type { RecuAffichable } from "@/lib/ventes/recu";

/** Reçu de démonstration partagé par les tests d'impression. */
export const recuExemple: RecuAffichable = {
  numeroRecu: "R-2026-000123",
  date: "2026-11-10T13:30:00Z",
  annule: false,
  remise: 500,
  total: 10500,
  boutique: {
    nom: "Quincaillerie du Centre",
    adresse: "Marché Mfoundi, Yaoundé",
    telephone: "699000000",
    mentionLegale: "Marchandise vendue, ni reprise ni échangée.",
  },
  client: { nom: "Jean Mbarga", telephone: null },
  lignes: [
    {
      nom: "Ciment CPJ 42,5 · Dangote",
      unite: "sac de 50 kg",
      quantite: 2,
      prixUnitaire: 5500,
      remiseLigne: 0,
      total: 11000,
    },
  ],
  paiements: [{ mode: "especes", montant: 6000 }],
  credit: 4500,
};
