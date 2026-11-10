import { Suspense } from "react";
import { InactiviteDeconnexion } from "@/components/inactivite";
import { Navigation } from "@/components/navigation";
import { menuPour } from "@/lib/permissions";
import { exigerRole } from "@/server/auth/session";

export default function MiseEnPageApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-muted p-6">Chargement…</p>}>
      <CadreProtege>{children}</CadreProtege>
    </Suspense>
  );
}

/** Lit la session : tout ce qui est dessous est réservé aux membres d'une boutique. */
async function CadreProtege({ children }: { children: React.ReactNode }) {
  const profil = await exigerRole("boutique");
  const menu =
    profil.role && profil.plan ? menuPour(profil.role, profil.plan) : [];
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <Navigation menu={menu} nom={profil.nom} />
      <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      <InactiviteDeconnexion />
    </div>
  );
}
