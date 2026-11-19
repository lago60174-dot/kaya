import { formatDateHeure, formatFcfa, formatQuantite } from "@/lib/format";
import {
  adresseComplete,
  type DocumentRecu,
  type TotalDocument,
} from "@/lib/print/document";
import {
  formatJour,
  libelleTypeDevis,
  type BoutiqueDocument,
  type DevisDetail,
} from "./devis";

function enTete(b: BoutiqueDocument) {
  return {
    boutique: {
      nom: b.nom,
      adresse: adresseComplete(b.adresse, b.ville),
      telephone: b.telephone,
    },
    identite: [b.email, b.rccm && `RCCM : ${b.rccm}`, b.niu && `NIU : ${b.niu}`].filter(
      (l): l is string => Boolean(l),
    ),
    signature:
      b.signatureCle || b.cachetCle || b.signataire
        ? {
            signataire: b.signataire ?? null,
            signatureUrl: b.signatureCle ? `/img/${b.signatureCle}` : null,
            cachetUrl: b.cachetCle ? `/img/${b.cachetCle}` : null,
          }
        : null,
  };
}

/** Devis ou proforma prêt pour le PDF. Jamais de coût d'achat ni de marge. */
export function documentDepuisDevis(d: DevisDetail): DocumentRecu {
  const totaux: TotalDocument[] = [];
  if (d.remise > 0) {
    totaux.push({
      libelle: "Sous-total",
      montant: formatFcfa(d.sousTotal),
      niveau: "normal",
    });
    totaux.push({
      libelle: "Remise",
      montant: `-${formatFcfa(d.remise)}`,
      niveau: "normal",
    });
  }
  totaux.push({ libelle: "TOTAL", montant: formatFcfa(d.total), niveau: "majeur" });
  const notes = [
    d.conditions ? `Conditions : ${d.conditions}` : null,
    d.note,
    "Bon pour accord (signature du client) : ______________________",
  ].filter((n): n is string => Boolean(n));
  const numero = d.numero ?? "brouillon";
  return {
    type: "devis",
    numero,
    titre: `${libelleTypeDevis(d.type)} ${numero}`,
    date: formatDateHeure(d.date),
    ...enTete(d.boutique),
    serviPar: null,
    client: d.client?.nom ?? null,
    precision: `Valable jusqu'au ${formatJour(d.valideJusqu)}`,
    annule: false,
    colonnes: { designation: "Désignation", quantite: true },
    lignes: d.lignes.map((l) => {
      const quantite = `${formatQuantite(l.quantite)} ${l.unite}`;
      const prix = formatFcfa(l.prixUnitaire);
      return {
        designation: l.nom,
        detail: `${quantite} × ${prix}`,
        quantite,
        prixUnitaire: prix,
        montant: formatFcfa(l.total),
      };
    }),
    totaux,
    notes,
    mentionLegale: d.boutique.mentionLegale,
    remerciement: d.boutique.mentionLegale
      ? ""
      : "Nous restons à votre disposition.",
  };
}

export interface BonLivraisonDetail {
  id: string;
  numero: string;
  date: string;
  adresse: string | null;
  note: string | null;
  /** Document d'origine : un reçu de vente ou un devis accepté. */
  source: { type: "vente" | "devis"; id: string; numero: string };
  client: { nom: string; telephone: string | null } | null;
  boutique: BoutiqueDocument;
  lignes: { nom: string; unite: string; quantite: number }[];
}

/** Bon de livraison : quantités seulement, jamais de prix. La quantité prend la place du montant. */
export function documentDepuisBonLivraison(b: BonLivraisonDetail): DocumentRecu {
  const nombre = b.lignes.length;
  return {
    type: "bon_livraison",
    numero: b.numero,
    titre: `Bon de livraison ${b.numero}`,
    date: formatDateHeure(b.date),
    ...enTete(b.boutique),
    serviPar: null,
    client: b.client?.nom ?? null,
    precision: `${b.source.type === "vente" ? "Reçu" : "Devis"} ${b.source.numero}`,
    annule: false,
    colonnes: { designation: "Désignation", quantite: true },
    lignes: b.lignes.map((l) => ({
      designation: l.nom,
      detail: null,
      quantite: `${formatQuantite(l.quantite)} ${l.unite}`,
      prixUnitaire: null,
      montant: `${formatQuantite(l.quantite)} ${l.unite}`,
    })),
    totaux: [
      {
        libelle: nombre > 1 ? `${nombre} articles livrés` : "1 article livré",
        montant: "",
        niveau: "fort",
      },
    ],
    notes: [
      b.adresse ? `Adresse de livraison : ${b.adresse}` : null,
      b.note,
      "Marchandise reçue en bon état par : ______________________",
      "Date : ____ / ____ / ________",
    ].filter((n): n is string => Boolean(n)),
    mentionLegale: b.boutique.mentionLegale,
    remerciement: "",
  };
}
