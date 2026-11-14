import { Suspense } from "react";
import { InactiviteDeconnexion } from "@/components/inactivite";
import { Navigation } from "@/components/navigation";
import { menuPour } from "@/lib/permissions";
import { exigerRole } from "@/server/auth/session";

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
  return (
    <div className="kaya-app-shell">
      <Navigation menu={menu} nom={profil.nom} />
      <main className="kaya-main">
        <div className="kaya-main-inner">{children}</div>
      </main>
      <InactiviteDeconnexion />
    </div>
  );
}
