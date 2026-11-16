import { Settings2 } from "lucide-react";
import Link from "next/link";
import { SectionAbonnement } from "@/components/abonnement/section-abonnement";
import { ChampLogo } from "@/components/boutique/champ-logo";
import { FormulaireIdentite } from "@/components/boutique/formulaire-identite";
import { ActionsVendeur } from "@/components/vendeurs/actions-vendeur";
import { FormulaireVendeur } from "@/components/vendeurs/formulaire-vendeur";
import { FormulaireParametres } from "@/components/parametres/formulaire-parametres";
import { LIBELLE_STATUT_FACTURE } from "@/lib/abonnement/abonnement";
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

export const metadata = { title: "Paramètres · Kaya" };

const ONGLETS = [
  ["boutique", "Boutique"],
  ["vendeurs", "Vendeurs"],
  ["abonnement", "Abonnement"],
] as const;

export default async function PageParametres({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const profil = await exigerRole("proprietaire");
  const demande = (await searchParams).onglet;
  const onglet = ONGLETS.some(([c]) => c === demande) ? demande : "boutique";
  const supabase = await supabaseServeur();
  const { data: vendeurs } = await supabase
    .from("membres")
    .select("id, nom, actif")
    .eq("role", "vendeur")
    .order("cree_le");
  const { data: boutique } = await supabase
    .from("boutiques")
    .select("logo_cle, signature_cle, cachet_cle, ville, email, rccm, niu, signataire")
    .eq("id", profil.boutiqueIds[0] ?? "")
    .maybeSingle();
  const logoUrl = boutique?.logo_cle ? urlImage(boutique.logo_cle) : null;
  const signatureUrl = boutique?.signature_cle ? urlImage(boutique.signature_cle) : null;
  const cachetUrl = boutique?.cachet_cle ? urlImage(boutique.cachet_cle) : null;
  const max = profil.plan ? limite(profil.plan, "vendeurs") : 0;
  const actifs = (vendeurs ?? []).filter((v) => v.actif).length;
  const peutAjouter = max === null || actifs < max;
  const boutiqueId = profil.boutiqueIds[0];
  const [parametres, abonnement] = await Promise.all([
    boutiqueId ? lireParametres(boutiqueId) : null,
    lireAbonnement(),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
          <Settings2 aria-hidden="true" size={26} />
        </span>
        <h1 className="text-xl font-bold">Paramètres</h1>
      </div>
      <nav aria-label="Sections des paramètres" className="flex flex-wrap gap-2">
        {ONGLETS.map(([code, libelle]) => (
          <Link
            key={code}
            href={`/parametres?onglet=${code}`}
            aria-current={code === onglet ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${code === onglet ? "bg-orange-500 text-white" : "bg-white text-[#17233d] shadow-sm"}`}
          >
            {libelle}
          </Link>
        ))}
      </nav>
      {onglet === "boutique" && !parametres && (
        <p className="text-danger" role="alert">
          Impossible de charger les paramètres de la boutique. Reconnectez-vous.
        </p>
      )}
            {onglet === "boutique" && (
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Logo de ma boutique</h2>
        <p className="text-muted text-sm">
          Il s&apos;affiche sur vos reçus, vos PDF et vos factures A4.
        </p>
        <ChampLogo logoUrl={logoUrl} />
      </section>
      )}
      {onglet === "boutique" && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Informations légales du reçu</h2>
            <p className="text-muted text-sm">
              Elles s&apos;impriment sur chaque reçu. Un reçu complet est plus crédible
              pour vos clients et vous protège en cas de litige.
            </p>
            <FormulaireIdentite
              valeurs={{
                ville: boutique?.ville ?? "",
                email: boutique?.email ?? "",
                rccm: boutique?.rccm ?? "",
                niu: boutique?.niu ?? "",
                signataire: boutique?.signataire ?? "",
              }}
            />
          </section>
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Ma signature</h2>
            <p className="text-muted text-sm">
              Signez sur une feuille blanche, posez-la à plat dans un endroit bien éclairé et
              prenez-la en photo. Le fond est retiré automatiquement.
            </p>
            <ChampLogo type="signature" logoUrl={signatureUrl} />
          </section>
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Mon cachet</h2>
            <p className="text-muted text-sm">
              Tamponnez votre cachet sur une feuille blanche, puis prenez-le en photo de la même façon.
            </p>
            <ChampLogo type="cachet" logoUrl={cachetUrl} />
          </section>
        </>
      )}
      {onglet === "boutique" && parametres && (
        <FormulaireParametres valeurs={parametres} />
      )}
            {onglet === "vendeurs" && (
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Mes vendeurs</h2>
        {(vendeurs ?? []).length === 0 ? (
          <p className="text-muted">
            Aucun vendeur. Créez le premier compte ci-dessous.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {(vendeurs ?? []).map((v) => (
              <li key={v.id} className="border-border rounded-2xl border p-3">
                <p className="flex items-center gap-3 font-bold">
                  <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-orange-100 text-orange-700">
                    {(v.nom ?? "V").charAt(0).toUpperCase()}
                  </span>
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
      )}
      {onglet === "abonnement" && profil.plan && (
        <SectionAbonnement planCode={profil.plan.code} />
      )}
      {onglet === "abonnement" && abonnement && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Historique des paiements</h2>
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
