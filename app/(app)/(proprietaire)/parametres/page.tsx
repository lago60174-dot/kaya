import { ChampLogo } from "@/components/boutique/champ-logo";
import { ActionsVendeur } from "@/components/vendeurs/actions-vendeur";
import { FormulaireVendeur } from "@/components/vendeurs/formulaire-vendeur";
import { FormulaireParametres } from "@/components/parametres/formulaire-parametres";
import {
  etatAbonnement,
  LIBELLE_STATUT_FACTURE,
} from "@/lib/abonnement/abonnement";
import { formatFcfa } from "@/lib/format";
import { urlImage } from "@/server/images/cles";
import { limite } from "@/lib/plans";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { lireAbonnement, lireParametres } from "@/server/parametres/lecture";

const date = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "Africa/Douala",
  }).format(new Date(d));
const TON = {
  normal: "bg-brand-soft",
  attention: "bg-amber-100",
  bloquant: "bg-red-100",
} as const;

export const metadata = { title: "Paramètres · Kaya" };

export default async function PageParametres() {
  const profil = await exigerRole("proprietaire");
  const supabase = await supabaseServeur();
  const { data: vendeurs } = await supabase
    .from("membres")
    .select("id, nom, actif")
    .eq("role", "vendeur")
    .order("cree_le");
  const { data: boutique } = await supabase
    .from("boutiques")
    .select("logo_cle")
    .eq("id", profil.boutiqueIds[0] ?? "")
    .maybeSingle();
  const logoUrl = boutique?.logo_cle ? urlImage(boutique.logo_cle) : null;
  const max = profil.plan ? limite(profil.plan, "vendeurs") : 0;
  const actifs = (vendeurs ?? []).filter((v) => v.actif).length;
  const peutAjouter = max === null || actifs < max;
  const boutiqueId = profil.boutiqueIds[0];
  const [parametres, abonnement] = await Promise.all([
    boutiqueId ? lireParametres(boutiqueId) : null,
    lireAbonnement(),
  ]);
  const etat = abonnement ? etatAbonnement(abonnement, new Date()) : null;

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <h1 className="text-2xl font-bold">Paramètres</h1>
      {parametres ? (
        <FormulaireParametres valeurs={parametres} />
      ) : (
        <p className="text-danger" role="alert">
          Impossible de charger les paramètres de la boutique. Reconnectez-vous.
        </p>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Logo de ma boutique</h2>
        <p className="text-muted text-sm">
          Il s&apos;affiche sur vos reçus, vos PDF et vos factures A4.
        </p>
        <ChampLogo logoUrl={logoUrl} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Mes vendeurs</h2>
        {(vendeurs ?? []).length === 0 ? (
          <p className="text-muted">
            Aucun vendeur. Créez le premier compte ci-dessous.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {(vendeurs ?? []).map((v) => (
              <li key={v.id} className="border-border rounded-lg border p-3">
                <p className="font-medium">
                  {v.nom ?? "Vendeur"}{" "}
                  {!v.actif && (
                    <span className="text-muted text-sm">(désactivé)</span>
                  )}
                </p>
                <ActionsVendeur membreId={v.id} actif={v.actif} />
              </li>
            ))}
          </ul>
        )}
        {peutAjouter ? (
          <FormulaireVendeur />
        ) : (
          <p className="bg-brand-soft rounded-lg p-3 text-sm">
            Votre abonnement permet {max} vendeur
            {max !== null && max > 1 ? "s" : ""} actif
            {max !== null && max > 1 ? "s" : ""}. Désactivez un vendeur pour en
            ajouter un autre.
          </p>
        )}
      </section>
      {abonnement && etat && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Mon abonnement</h2>
          <div className={`${TON[etat.ton]} rounded-lg p-3`}>
            <p className="font-medium">
              Formule {profil.plan?.nom ?? abonnement.planCode} · {etat.libelle}
            </p>
            <p className="text-sm">{etat.message}</p>
            {abonnement.planEnAttente && (
              <p className="text-sm">
                Changement de formule prévu à la prochaine échéance.
              </p>
            )}
          </div>
          <h3 className="font-semibold">Historique des paiements</h3>
          {abonnement.factures.length === 0 ? (
            <p className="text-muted">Aucun paiement pour le moment.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-lg border">
              {abonnement.factures.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <span>
                    {date(f.echeance)}
                    <span className="text-muted block text-sm">
                      {LIBELLE_STATUT_FACTURE[f.statut] ?? f.statut}
                      {f.payeeLe ? ` le ${date(f.payeeLe)}` : ""}
                    </span>
                  </span>
                  <span className="font-medium">{formatFcfa(f.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
