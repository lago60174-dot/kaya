/** Frais Fapshi (3 %), pour l'exemple de commission affiché sur la page partenaire. */
export const FRAIS_PAIEMENT_POURCENT = 3;

export interface ExempleCommission {
  brut: number;
  frais: number;
  net: number;
  commission: number;
}

/** Même règle que la section 13 : commission sur le net encaissé, arrondie au FCFA le plus proche. Entiers uniquement. */
export function exempleCommission(
  prixMensuel: number,
  commissionPourcentage: number,
  fraisPourcent: number = FRAIS_PAIEMENT_POURCENT,
): ExempleCommission {
  const frais = Math.round((prixMensuel * fraisPourcent) / 100);
  const net = prixMensuel - frais;
  // Pourcentage à 2 décimales au plus (numeric(5,2)) : on passe en centièmes pour rester entier.
  const centiemes = Math.round(commissionPourcentage * 100);
  const commission = Math.round((net * centiemes) / 10000);
  return { brut: prixMensuel, frais, net, commission };
}
