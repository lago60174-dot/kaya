import { Suspense } from "react";
import { InactiviteDeconnexion } from "@/components/inactivite";
import { EtatConnexion } from "@/components/hors-ligne/etat-connexion";
import { Navigation } from "@/components/navigation";
import { menuPour } from "@/lib/permissions";
import { BandeauAbonnement } from "@/components/abonnement/bandeau";
import { BandeauConfirmation } from "@/components/auth/bandeau-confirmation";
import { SelecteurBoutique } from "@/components/boutiques/selecteur-boutique";
import { emailConfigure } from "@/server/email/resend";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { compterNonLues } from "@/server/notifications/lecture";

export default function MiseEnPageApplication({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-muted p-6">Chargement…</p>}>
      <CadreProtege>{children}</CadreProtege>
    </Suspense>
  );
}

async function CadreProtege({ children }: { children: React.ReactNode }) {
  const profil = await exigerRole("boutique");
  const menu = profil.role && profil.plan ? menuPour(profil.role, profil.plan) : [];
  if (profil.estAdmin) menu.push({ href: "/admin", libelle: "Administration" });
  const nonLues =
    profil.role === "proprietaire"
      ? await compterNonLues(await supabaseServeur())
      : 0;
  return (
    <div className="kaya-app-shell">
      <Navigation menu={menu} nom={profil.nom} nonLues={nonLues} />
      <main className="kaya-main">
        <div className="kaya-main-inner">
          <EtatConnexion />
          {profil.role === "proprietaire" && !profil.emailVerifie && emailConfigure() && (
            <BandeauConfirmation />
          )}
          <Suspense fallback={null}>
            <BandeauAbonnement estProprietaire={profil.role === "proprietaire"} />
          </Suspense>
          {profil.boutiques.length > 1 && (
            <div className="mb-4 max-w-sm">
              <SelecteurBoutique boutiques={profil.boutiques} activeId={profil.boutiqueActiveId} />
            </div>
          )}
          {profil.boutiques.some((b) => b.id === profil.boutiqueActiveId && !b.enEcriture) && (
            <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Cette boutique dépasse ce que permet votre abonnement : vous pouvez la consulter, mais plus la modifier.
            </p>
          )}
          {children}
        </div>
      </main>
      <InactiviteDeconnexion />
    </div>
  );
}
