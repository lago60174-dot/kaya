import { redirect } from "next/navigation";
import { ChoixPlanInitial } from "@/components/abonnement/choix-plan-initial";
import { formatFcfa } from "@/lib/format";
import { accueilPour } from "@/lib/permissions";
import { lignesPlan } from "@/lib/vitrine/comparatif";
import { exigerRole } from "@/server/auth/session";
import { chargerOffrePublique } from "@/server/vitrine/offre-publique";

export const metadata = { title: "Choisir ma formule · Kaya" };

/**
 * Étape obligatoire de la création de la boutique : tant qu'aucune formule n'est choisie, le propriétaire ne peut rien
 * faire d'autre (garde centrale dans decisionGarde). Le paiement, lui, peut venir plus tard.
 */
export default async function PageChoisirPlan() {
  const profil = await exigerRole("connecte");
  if (profil.role !== "proprietaire") redirect(accueilPour(profil.role ?? "vendeur"));
  if (!profil.planAChoisir) redirect("/patron");

  const { plans } = await chargerOffrePublique();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-medium">Dernière étape avant votre boutique</p>
        <h1 className="text-brand-strong text-3xl font-bold">Choisissez votre formule</h1>
        <p>
          Choisissez maintenant, payez quand vous voulez. Le règlement se fait par MTN Mobile Money ou
          Orange Money, depuis Paramètres. La formule choisie s&apos;active à votre premier paiement et vous
          pourrez en changer plus tard.
        </p>
      </header>
      {plans.length === 0 ? (
        <p role="alert" className="bg-brand-soft rounded-lg p-4">
          Les formules ne sont pas disponibles pour le moment. Rechargez la page dans quelques minutes : votre
          boutique est créée, rien n&apos;est perdu.
        </p>
      ) : (
        <ChoixPlanInitial
          plans={plans.map((p) => ({
            code: p.code,
            nom: p.nom,
            prix: formatFcfa(p.prixMensuel),
            lignes: lignesPlan(p),
          }))}
        />
      )}
      <p className="text-muted text-sm">
        Sans paiement après le délai de grâce, l&apos;application passe en lecture seule : vous consultez tout,
        vos données sont conservées. Réglez, et tout rouvre.
      </p>
    </main>
  );
}
