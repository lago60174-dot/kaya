import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bornesJour, type ResumeCaisse } from "@/lib/caisse/caisse";

export interface LigneDepense {
  id: string;
  categorie: string;
  montant: number;
  mode: string;
  note: string | null;
  date: string;
  auteur: string | null;
  /** Annulée : visible, barrée, et exclue de la caisse. */
  annulee: boolean;
  motifAnnulation: string | null;
}

export interface Cloture {
  id: string;
  date: string;
  especesAttendues: number;
  especesComptees: number;
  ecart: number;
  validee: boolean;
  cloturePar: string | null;
}

export interface CaisseDuJour {
  resume: ResumeCaisse;
  tolerance: number;
  cloture: Cloture | null;
  depenses: LigneDepense[];
}

type Brut = Record<string, number>;
const n = (b: Brut, cle: string) => Number(b[cle] ?? 0);

function versResume(b: Brut): ResumeCaisse {
  return {
    ventesTotal: n(b, "ventes_total"),
    nbVentes: n(b, "nb_ventes"),
    creditAccorde: n(b, "credit_accorde"),
    encaissementsEspeces: n(b, "encaissements_especes"),
    remboursementsCreditEspeces: n(b, "remboursements_credit_especes"),
    mtnMomo: n(b, "mtn_momo"),
    orangeMoney: n(b, "orange_money"),
    mtnMomoRembourse: n(b, "mtn_momo_rembourse"),
    orangeMoneyRembourse: n(b, "orange_money_rembourse"),
    depensesTotal: n(b, "depenses_total"),
    depensesEspeces: n(b, "depenses_especes"),
    avoirsEspeces: n(b, "avoirs_especes"),
    especesAttendues: n(b, "especes_attendues"),
  };
}

/** Noms des membres visibles par l'appelant (le propriétaire voit tout le monde, un vendeur seulement lui-même). */
async function nomsMembres(supabase: SupabaseClient) {
  const { data } = await supabase.from("membres").select("utilisateur_id, nom");
  return new Map(
    (data ?? []).map((m) => [m.utilisateur_id as string, m.nom as string]),
  );
}

function versCloture(
  c: {
    id: string;
    date: string;
    especes_attendues: number;
    especes_comptees: number;
    ecart: number;
    validee_le: string | null;
    auteur_id: string | null;
  },
  noms: Map<string, string>,
): Cloture {
  return {
    id: c.id,
    date: c.date,
    especesAttendues: Number(c.especes_attendues),
    especesComptees: Number(c.especes_comptees),
    ecart: Number(c.ecart),
    validee: c.validee_le !== null,
    cloturePar: c.auteur_id ? (noms.get(c.auteur_id) ?? null) : null,
  };
}

/** Résumé d'une journée (calculé par la base), dépenses de la journée et clôture éventuelle. */
export async function lireCaisse(
  supabase: SupabaseClient,
  boutiqueId: string,
  jour: string,
): Promise<CaisseDuJour | null> {
  const { debut, fin } = bornesJour(jour);
  const [resume, params, cloture, depenses, noms] = await Promise.all([
    supabase.rpc("calculer_caisse", { p_boutique: boutiqueId, p_date: jour }),
    supabase
      .from("parametres_boutique")
      .select("ecart_caisse_tolere")
      .eq("boutique_id", boutiqueId)
      .maybeSingle(),
    supabase
      .from("clotures_caisse")
      .select(
        "id, date, especes_attendues, especes_comptees, ecart, validee_le, auteur_id",
      )
      .eq("boutique_id", boutiqueId)
      .eq("date", jour)
      .maybeSingle(),
    supabase
      .from("depenses")
      .select(
        "id, categorie, montant, mode, note, date, auteur_id, annulee_le, motif_annulation",
      )
      .eq("boutique_id", boutiqueId)
      .gte("date", debut)
      .lt("date", fin)
      .order("date", { ascending: false })
      .limit(200),
    nomsMembres(supabase),
  ]);
  if (resume.error || !resume.data) return null;
  return {
    resume: versResume(resume.data as Brut),
    tolerance: Number(params.data?.ecart_caisse_tolere ?? 0),
    cloture: cloture.data ? versCloture(cloture.data, noms) : null,
    depenses: (depenses.data ?? []).map((d) => ({
      id: d.id,
      categorie: d.categorie,
      montant: Number(d.montant),
      mode: d.mode,
      note: d.note,
      date: d.date,
      auteur: d.auteur_id ? (noms.get(d.auteur_id) ?? null) : null,
      annulee: d.annulee_le !== null,
      motifAnnulation: d.motif_annulation,
    })),
  };
}

/** Dernières clôtures, de la plus récente à la plus ancienne. */
export async function listerClotures(
  supabase: SupabaseClient,
  boutiqueId: string,
  limite = 14,
): Promise<Cloture[]> {
  const [{ data }, noms] = await Promise.all([
    supabase
      .from("clotures_caisse")
      .select(
        "id, date, especes_attendues, especes_comptees, ecart, validee_le, auteur_id",
      )
      .eq("boutique_id", boutiqueId)
      .order("date", { ascending: false })
      .limit(limite),
    nomsMembres(supabase),
  ]);
  return (data ?? []).map((c) => versCloture(c, noms));
}
