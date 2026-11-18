/** Chiffres du jour d'une boutique, dans la vue d'ensemble du propriétaire. */
export interface LigneConsolidee {
  boutiqueId: string;
  nom: string;
  enEcriture: boolean;
  ventesTotal: number;
  nbVentes: number;
  ventesHier: number;
  especesAttendues: number;
  mobileMoney: number;
  depensesTotal: number;
  creditAccorde: number;
  dettesTotal: number;
  nbDebiteurs: number;
  stockBas: number;
  cloturesAValider: number;
}

export type TotauxConsolides = Omit<
  LigneConsolidee,
  "boutiqueId" | "nom" | "enEcriture"
>;

const n = (v: unknown): number => {
  const x = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : 0;
};

/** Lecture sûre de `tableau_de_bord_consolide` : une ligne illisible est ignorée, jamais de plantage. */
export function lireLignesConsolidees(brut: unknown): LigneConsolidee[] {
  if (!Array.isArray(brut)) return [];
  const lignes: LigneConsolidee[] = [];
  for (const b of brut) {
    if (!b || typeof b !== "object") continue;
    const l = b as Record<string, unknown>;
    if (typeof l.boutique_id !== "string" || typeof l.nom !== "string") continue;
    lignes.push({
      boutiqueId: l.boutique_id,
      nom: l.nom,
      enEcriture: l.en_ecriture !== false,
      ventesTotal: n(l.ventes_total),
      nbVentes: n(l.nb_ventes),
      ventesHier: n(l.ventes_hier),
      especesAttendues: n(l.especes_attendues),
      mobileMoney: n(l.mobile_money),
      depensesTotal: n(l.depenses_total),
      creditAccorde: n(l.credit_accorde),
      dettesTotal: n(l.dettes_total),
      nbDebiteurs: n(l.nb_debiteurs),
      stockBas: n(l.stock_bas),
      cloturesAValider: n(l.clotures_a_valider),
    });
  }
  return lignes;
}

/** Somme des boutiques. Les sommes sont celles de la base, additionnées : aucun recalcul de règle métier ici. */
export function totaliser(lignes: readonly LigneConsolidee[]): TotauxConsolides {
  const t: TotauxConsolides = {
    ventesTotal: 0,
    nbVentes: 0,
    ventesHier: 0,
    especesAttendues: 0,
    mobileMoney: 0,
    depensesTotal: 0,
    creditAccorde: 0,
    dettesTotal: 0,
    nbDebiteurs: 0,
    stockBas: 0,
    cloturesAValider: 0,
  };
  for (const l of lignes) {
    t.ventesTotal += l.ventesTotal;
    t.nbVentes += l.nbVentes;
    t.ventesHier += l.ventesHier;
    t.especesAttendues += l.especesAttendues;
    t.mobileMoney += l.mobileMoney;
    t.depensesTotal += l.depensesTotal;
    t.creditAccorde += l.creditAccorde;
    t.dettesTotal += l.dettesTotal;
    t.nbDebiteurs += l.nbDebiteurs; // un client qui doit dans deux boutiques compte deux fois : voir DECISIONS.md
    t.stockBas += l.stockBas;
    t.cloturesAValider += l.cloturesAValider;
  }
  return t;
}
