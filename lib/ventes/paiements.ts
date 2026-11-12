import { lireMontant } from "@/lib/stock/quantites";

export type ModePaiement = "especes" | "mtn_momo" | "orange_money";

export const MODES_PAIEMENT: { code: ModePaiement; libelle: string }[] = [
  { code: "especes", libelle: "Espèces" },
  { code: "mtn_momo", libelle: "MTN MoMo" },
  { code: "orange_money", libelle: "Orange Money" },
];

export const libelleMode = (code: string) =>
  MODES_PAIEMENT.find((m) => m.code === code)?.libelle ?? code;

export interface LignePaiement {
  mode: ModePaiement;
  montant: string;
}

export interface PaiementEnvoye {
  mode: ModePaiement;
  montant?: number;
}

export type PreparationPaiements =
  | { ok: true; paiements: PaiementEnvoye[]; credit: number }
  | { ok: false; erreur: string };

/**
 * Transforme la saisie en paiements pour le serveur.
 * - Sans crédit : le dernier mode prend le reste (son montant n'est pas saisi). Un seul mode = paiement complet.
 * - Avec crédit : chaque ligne a son montant, et ce qui n'est pas payé devient la dette du client (0 ligne = tout à crédit).
 */
export function preparerPaiements(
  lignes: LignePaiement[],
  credit: boolean,
  total: number,
): PreparationPaiements {
  if (total <= 0) return { ok: false, erreur: "Ajoutez au moins un article." };
  const aSaisir = credit ? lignes : lignes.slice(0, -1);
  if (!credit && lignes.length === 0)
    return { ok: false, erreur: "Choisissez un mode de paiement." };

  const paiements: PaiementEnvoye[] = [];
  let somme = 0;
  for (const l of aSaisir) {
    const m = lireMontant(l.montant);
    if (m === null || m <= 0)
      return {
        ok: false,
        erreur: "Entrez un montant en FCFA pour chaque mode de paiement.",
      };
    paiements.push({ mode: l.mode, montant: m });
    somme += m;
  }
  if (credit) {
    if (somme >= total)
      return {
        ok: false,
        erreur: "Le montant payé couvre déjà le total : retirez le crédit.",
      };
    return { ok: true, paiements, credit: total - somme };
  }
  if (somme >= total)
    return {
      ok: false,
      erreur:
        "Les premiers paiements couvrent déjà le total : retirez le dernier mode.",
    };
  paiements.push({ mode: lignes[lignes.length - 1].mode });
  return { ok: true, paiements, credit: 0 };
}
