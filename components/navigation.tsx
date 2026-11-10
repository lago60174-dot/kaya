import Link from "next/link";
import type { EntreeMenu } from "@/lib/permissions";
import { deconnecter } from "@/server/auth/actions";

/** Barre en bas sur téléphone, barre latérale sur PC. Le menu est déjà filtré selon le rôle et le plan. */
export function Navigation({
  menu,
  nom,
}: {
  menu: EntreeMenu[];
  nom: string | null;
}) {
  return (
    <nav
      aria-label="Menu principal"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-10 flex items-center gap-1 overflow-x-auto border-t px-2 md:static md:w-56 md:flex-col md:items-stretch md:gap-2 md:overflow-visible md:border-t-0 md:border-r md:px-4 md:py-6"
    >
      <span className="text-brand-strong hidden text-2xl font-bold md:block">
        Kaya
      </span>
      {nom && <span className="text-muted hidden text-sm md:block">{nom}</span>}
      {menu.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="hover:bg-brand-soft flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium"
        >
          {m.libelle}
        </Link>
      ))}
      <form action={deconnecter} className="shrink-0 md:mt-auto">
        <button
          type="submit"
          className="text-muted hover:bg-brand-soft flex min-h-11 items-center rounded-lg px-3 text-sm"
        >
          Se déconnecter
        </button>
      </form>
    </nav>
  );
}
