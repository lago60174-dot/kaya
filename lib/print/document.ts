import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import type { PaiementRecu } from "@/lib/clients/messages";
import { libelleMode } from "@/lib/ventes/paiements";
import type { RecuAffichable } from "@/lib/ventes/recu";

/**
 * Modèle unique d'un reçu à imprimer. Le ticket ESC/POS, le ticket et la facture A4 du navigateur, et le PDF
 * partent tous de lui : une règle de présentation ne s'écrit qu'une fois. Aucun coût d'achat ni marge ici.
 */
export interface LigneDocument {
  designation: string;
  /** Ex. « 2 sac de 50 kg × 5 500 FCFA (remise 200 FCFA) » : sous la désignation sur ticket et PDF. */
  detail: string | null;
  /** Colonnes de la facture A4 (absentes pour un reçu de paiement). */
  quantite: string | null;
  prixUnitaire: string | null;
  montant: string;
}

/** `majeur` : le total. `fort` : une ligne qui compte (reste à payer). `discret` : information (mode de paiement). */
export interface TotalDocument {
  libelle: string;
  montant: string;
  niveau: "normal" | "fort" | "majeur" | "discret";
}

export interface DocumentRecu {
  type: "vente" | "paiement";
  /** Numéro seul, pour nommer le fichier : R-2026-000123 ou P-2026-12. */
  numero: string;
  /** « Reçu R-2026-000123 » ou « Reçu de paiement P-2026-12 ». */
  titre: string;
  date: string;
  boutique: { nom: string; adresse: string | null; telephone: string | null };
  client: string | null;
  /** Ligne d'information sous le client (ex. « Payé par Espèces »). */
  precision: string | null;
  annule: boolean;
  colonnes: { designation: string; quantite: boolean };
  lignes: LigneDocument[];
  totaux: TotalDocument[];
  mentionLegale: string | null;
  remerciement: string;
}

export function documentDepuisVente(recu: RecuAffichable): DocumentRecu {
  const totaux: TotalDocument[] = [];
  if (recu.remise > 0)
    totaux.push({
      libelle: "Remise",
      montant: `-${formatFcfa(recu.remise)}`,
      niveau: "normal",
    });
  totaux.push({
    libelle: "TOTAL",
    montant: formatFcfa(recu.total),
    niveau: "majeur",
  });
  for (const p of recu.paiements)
    totaux.push({
      libelle: libelleMode(p.mode),
      montant: formatFcfa(p.montant),
      niveau: "discret",
    });
  if (recu.credit > 0)
    totaux.push({
      libelle: "Reste à payer",
      montant: formatFcfa(recu.credit),
      niveau: "fort",
    });
  return {
    type: "vente",
    numero: recu.numeroRecu,
    titre: `Reçu ${recu.numeroRecu}`,
    date: formatDateHeure(recu.date),
    boutique: {
      nom: recu.boutique.nom,
      adresse: recu.boutique.adresse,
      telephone: recu.boutique.telephone,
    },
    client: recu.client?.nom ?? null,
    precision: null,
    annule: recu.annule,
    colonnes: { designation: "Désignation", quantite: true },
    lignes: recu.lignes.map((l) => {
      const quantite = `${formatQuantite(l.quantite)} ${l.unite}`;
      const prix = formatFcfa(l.prixUnitaire);
      return {
        designation: l.nom,
        detail: `${quantite} × ${prix}${l.remiseLigne > 0 ? ` (remise ${formatFcfa(l.remiseLigne)})` : ""}`,
        quantite,
        prixUnitaire: prix,
        montant: formatFcfa(l.total),
      };
    }),
    totaux,
    mentionLegale: recu.boutique.mentionLegale,
    remerciement: "Merci de votre confiance !",
  };
}

export interface PaiementImprimable extends PaiementRecu {
  boutiqueAdresse?: string | null;
  boutiqueTelephone?: string | null;
}

export function documentDepuisPaiement(
  p: PaiementImprimable,
  mentionLegale: string | null = null,
): DocumentRecu {
  return {
    type: "paiement",
    numero: p.numero,
    titre: `Reçu de paiement ${p.numero}`,
    date: formatDateHeure(p.date),
    boutique: {
      nom: p.boutique,
      adresse: p.boutiqueAdresse ?? null,
      telephone: p.boutiqueTelephone ?? null,
    },
    client: p.client,
    precision: `Payé par ${libelleMode(p.mode)}`,
    annule: false,
    colonnes: { designation: "Reçu de vente", quantite: false },
    lignes: p.repartition.map((r) => ({
      designation: r.numeroRecuVente,
      detail:
        r.soldeApres === 0 ? "Soldé" : `Reste ${formatFcfa(r.soldeApres)}`,
      quantite: null,
      prixUnitaire: null,
      montant: formatFcfa(r.montant),
    })),
    totaux: [
      {
        libelle: "TOTAL PAYÉ",
        montant: formatFcfa(p.montant),
        niveau: "majeur",
      },
      p.detteRestante > 0
        ? {
            libelle: "Reste à payer",
            montant: formatFcfa(p.detteRestante),
            niveau: "fort",
          }
        : {
            libelle: "Le client ne doit plus rien",
            montant: "",
            niveau: "fort",
          },
    ],
    mentionLegale,
    remerciement: "Merci de votre confiance !",
  };
}
