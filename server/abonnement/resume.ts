import { envoyerModele } from "@/lib/zernio/client";
import { LANGUE_MODELES, MODELE_RESUME, telephoneInternational, variablesResume } from "@/lib/zernio/modeles";
import type { Services } from "./coeur";

interface ResumeReserve {
  envoi_id: string;
  destinataire: string;
  boutique_nom: string | null;
  ventes_total: number | string;
  nb_ventes: number | string;
  produit_phare: string | null;
  stock_bas: number | string;
  credits: number | string;
}

/**
 * Envoie les résumés du jour (jour = date de Douala, par défaut aujourd'hui). La base réserve un seul envoi par boutique et par jour ;
 * un échec est noté et retenté à la prochaine exécution (3 fois au plus) sans jamais bloquer les autres boutiques.
 */
export async function envoyerResumes(s: Services, jour?: string): Promise<{ envoyes: number; echecs: number }> {
  const r = { envoyes: 0, echecs: 0 };
  if (!s.zernio) return r;
  const { data } = await s.db.rpc("reserver_resumes", jour ? { p_jour: jour } : {});
  const date = jour ? new Date(`${jour}T12:00:00Z`) : new Date();
  for (const x of (data ?? []) as ResumeReserve[]) {
    const tel = telephoneInternational(x.destinataire);
    const resultat = tel
      ? await envoyerModele(
          s.zernio,
          {
            telephone: tel,
            modele: MODELE_RESUME,
            langue: LANGUE_MODELES,
            variables: variablesResume({
              boutique: x.boutique_nom ?? "",
              jour: date,
              ventesTotal: Number(x.ventes_total),
              nbVentes: Number(x.nb_ventes),
              produitPhare: x.produit_phare,
              stockBas: Number(x.stock_bas),
              credits: Number(x.credits),
            }),
          },
          s.http,
        )
      : ({ ok: false, erreur: "Numéro invalide" } as const);
    await s.db
      .from("envois_whatsapp")
      .update(resultat.ok ? { statut: "envoye", erreur: null } : { statut: "echec", erreur: resultat.erreur })
      .eq("id", x.envoi_id);
    if (resultat.ok) r.envoyes++;
    else r.echecs++;
  }
  return r;
}
