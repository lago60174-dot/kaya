import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { deconnecter } from "@/server/auth/actions";
import { exigerRole } from "@/server/auth/session";

export const metadata: Metadata = { title: "Administration · Kaya", robots: { index: false, follow: false } };

const LIENS = [
  ["/admin", "Vue d'ensemble"],
  ["/admin/boutiques", "Boutiques"],
  ["/admin/paiements", "Paiements"],
  ["/admin/plans", "Plans"],
  ["/admin/partenaires", "Partenaires"],
  ["/admin/journal", "Journal"],
] as const;

export default function MiseEnPageAdmin({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="text-muted p-6">Chargement…</p>}>
      <CadreAdmin>{children}</CadreAdmin>
    </Suspense>
  );
}

async function CadreAdmin({ children }: { children: React.ReactNode }) {
  const profil = await exigerRole("admin");
  return (
    <div className="min-h-screen bg-[#fff8f1]">
      <header className="bg-[#17233d] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <strong className="text-lg">Kaya · Administration</strong>
          <nav aria-label="Administration" className="flex flex-1 flex-wrap gap-1">
            {LIENS.map(([href, libelle]) => (
              <Link key={href} href={href} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-white/10">
                {libelle}
              </Link>
            ))}
          </nav>
          <span className="hidden text-sm opacity-70 sm:inline">{profil.email}</span>
          <form action={deconnecter}>
            <button type="submit" className="min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-white/10">
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">{children}</main>
    </div>
  );
}
