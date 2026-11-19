import Link from "next/link";

const ONGLETS = [
  { href: "/fournisseurs", libelle: "Fournisseurs" },
  { href: "/fournisseurs/commandes", libelle: "Commandes" },
  { href: "/fournisseurs/dettes", libelle: "Dettes" },
  { href: "/fournisseurs/prix", libelle: "Prix d'achat" },
];

export function OngletsFournisseurs({ actif }: { actif: string }) {
  return (
    <nav aria-label="Fournisseurs" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {ONGLETS.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.href === actif ? "page" : undefined}
          className={`flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold ${o.href === actif ? "bg-orange-500 text-white" : "border-border border bg-white"}`}
        >
          {o.libelle}
        </Link>
      ))}
    </nav>
  );
}
