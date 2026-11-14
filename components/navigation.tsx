"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BookText,
  Boxes,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings2,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { EntreeMenu } from "@/lib/permissions";
import { deconnecter } from "@/server/auth/actions";

const icones: Record<string, typeof LayoutDashboard> = {
  "/patron": LayoutDashboard,
  "/vente": ShoppingCart,
  "/recus": ReceiptText,
  "/stock": Boxes,
  "/clients": Users,
  "/caisse": Wallet,
  "/journal": Activity,
  "/devis": ClipboardList,
  "/fournisseurs": Store,
  "/parametres": Settings2,
};

const ordreMobile = ["/patron", "/vente", "/stock", "/clients", "/caisse"];

export function Navigation({ menu, nom }: { menu: EntreeMenu[]; nom: string | null }) {
  const chemin = usePathname();
  const estActif = (href: string) => chemin === href || (href !== "/" && chemin.startsWith(`${href}/`));
  const liensMobile = ordreMobile.map((href) => menu.find((m) => m.href === href)).filter((m): m is EntreeMenu => Boolean(m));

  const lien = (m: EntreeMenu, mobile = false) => {
    const Icone = icones[m.href] ?? BookText;
    const actif = estActif(m.href);
    return (
      <Link
        key={m.href}
        href={m.href}
        aria-current={actif ? "page" : undefined}
        className={`kaya-nav-link ${actif ? "is-active" : ""} ${mobile ? "kaya-nav-mobile-link" : ""}`}
      >
        <Icone aria-hidden="true" size={19} strokeWidth={actif ? 2.5 : 2} />
        <span>{m.libelle === "Tableau de bord" ? "Accueil" : m.libelle}</span>
        {!mobile && <ChevronRight className="kaya-nav-chevron" size={15} />}
      </Link>
    );
  };

  return (
    <>
      <aside className="kaya-sidebar">
        <Link href={menu.some((m) => m.href === "/patron") ? "/patron" : "/vente"} className="kaya-brand-lockup">
          <span className="kaya-brand-mark"><Image src="/logo-kaya-96.webp" alt="" width={42} height={42} /></span>
          <span className="kaya-brand-copy"><strong>Kaya</strong><small>Gérez. Vendez. Grandissez.</small></span>
        </Link>
        <div className="kaya-sidebar-caption">ESPACE DE GESTION</div>
        <nav aria-label="Menu principal" className="kaya-sidebar-menu">
          {menu.map((m) => lien(m))}
        </nav>
        <div className="kaya-sidebar-bottom">
          <div className="kaya-user-card">
            <span className="kaya-user-avatar">{(nom?.trim().charAt(0) || "K").toUpperCase()}</span>
            <span className="kaya-user-meta"><strong>{nom || "Mon compte"}</strong><small>Votre boutique</small></span>
            <Bell size={17} />
          </div>
          <form action={deconnecter}>
            <button type="submit" className="kaya-logout"><LogOut size={17} /> Se déconnecter</button>
          </form>
        </div>
      </aside>

      <header className="kaya-mobile-header">
        <Link href={menu.some((m) => m.href === "/patron") ? "/patron" : "/vente"} className="kaya-mobile-brand">
          <Image src="/logo-kaya-96.webp" alt="" width={36} height={36} />
          <strong>Kaya</strong>
        </Link>
        <div className="kaya-mobile-status"><span /> En ligne</div>
      </header>
      <nav aria-label="Navigation mobile" className="kaya-mobile-nav">
        {liensMobile.map((m) => lien(m, true))}
        <Link href={menu.find((m) => m.href === "/parametres")?.href ?? "/recus"} className="kaya-nav-mobile-link kaya-nav-more">
          <CircleHelp size={19} /><span>Plus</span>
        </Link>
      </nav>
    </>
  );
}
