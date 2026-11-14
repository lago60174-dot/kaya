import {
  ArrowRight,
  Check,
  FileText,
  Package,
  Play,
  Rocket,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { Plan } from "@/lib/plans";
import { prixParMois } from "@/lib/vitrine/offre";
import { boutonOrange, boutonBlanc } from "./boutons";

const conteneur = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const peche = "bg-[#fdeee3]";

function Coche({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--kaya)] text-white">
        <Check aria-hidden="true" size={15} strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

export function Hero({ plan }: { plan: Plan | undefined }) {
  return (
    <section id="accueil" className="overflow-hidden bg-[#fffaf6]">
      <div className={`${conteneur} grid items-center gap-4 lg:grid-cols-[1.05fr_1fr]`}>
        <div className="relative z-10 py-8 lg:py-16">
          <h1 className="text-[clamp(2.4rem,5.2vw,3.9rem)] leading-[1.08] font-bold text-[var(--nuit)]">
            La gestion intelligente de votre quincaillerie,{" "}
            <span className="text-[var(--kaya)]">sur votre téléphone !</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-[var(--nuit)]">
            Avec Kaya, suivez vos ventes, votre stock, vos crédits clients et
            votre caisse en temps réel, où que vous soyez.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-[var(--nuit)]">
            <Coche>Gestion de stock simple et efficace</Coche>
            <Coche>Suivi des ventes et des profits</Coche>
            <Coche>Gestion des crédits clients</Coche>
            <Coche>Rapports en temps réel</Coche>
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/inscription" className={boutonOrange}>
              <Rocket aria-hidden="true" size={20} />
              Commencer maintenant
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
            <a href="#demo" className="flex min-h-12 items-center gap-3 font-bold text-[var(--nuit)]">
              <span className="grid size-12 place-items-center rounded-full border-2 border-[var(--kaya)] text-[var(--kaya)]">
                <Play aria-hidden="true" size={18} fill="currentColor" />
              </span>
              Voir la démo
            </a>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[#15803d]">
            <ShieldCheck aria-hidden="true" size={20} />
            Vos données sont sécurisées
          </p>
          {plan && (
            <p className="mt-2 text-sm text-[var(--nuit)]">
              {prixParMois(plan)}, à payer par MTN Mobile Money ou Orange Money.
            </p>
          )}
        </div>
        <div className="relative -mx-5 sm:-mx-8 lg:mx-0 lg:-mr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/vitrine/hero.webp"
            alt="Un vendeur de quincaillerie sourit en montrant l'application Kaya sur son téléphone."
            width={554}
            height={500}
            fetchPriority="high"
            className="h-auto w-full [mask-image:linear-gradient(to_right,transparent,#000_22%)]"
          />
        </div>
      </div>
    </section>
  );
}

const ATOUTS = [
  [TrendingUp, "Suivi en temps réel", "Gardez le contrôle de votre activité en temps réel."],
  [Package, "Gestion de stock avancée", "Évitez les ruptures et les pertes."],
  [Users, "Clients & Crédits", "Suivez vos clients et leurs dettes."],
  [Wallet, "Caisse intelligente", "Suivez vos encaissements (Mobile Money, Espèces…)."],
  [FileText, "Rapports détaillés", "Analysez vos ventes et prenez de meilleures décisions."],
  [Smartphone, "Accessible partout", "Sur téléphone et PC, même hors boutique."],
] as const;

function Titre({ sur, titre }: { sur: string; titre: string }) {
  return (
    <div className="text-center">
      <p className="flex items-center justify-center gap-4 text-xl font-bold text-[var(--kaya)]">
        <span aria-hidden="true" className="h-0.5 w-12 bg-[var(--kaya)]" />
        {sur}
        <span aria-hidden="true" className="h-0.5 w-12 bg-[var(--kaya)]" />
      </p>
      <h2 className="mt-2 text-3xl font-bold text-[var(--nuit)] sm:text-4xl">{titre}</h2>
    </div>
  );
}

export function Pourquoi() {
  return (
    <section id="fonctionnalites" className="bg-white py-12 lg:py-16">
      <div className={conteneur}>
        <Titre sur="Pourquoi choisir Kaya ?" titre="Une solution complète et facile à utiliser" />
        <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ATOUTS.map(([Icone, titre, texte]) => (
            <li key={titre} className={`${peche} flex items-center gap-4 rounded-2xl p-5`}>
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white text-[var(--kaya)]">
                <Icone aria-hidden="true" size={30} />
              </span>
              <span>
                <b className="block text-lg text-[var(--nuit)]">{titre}</b>
                <span className="text-[var(--nuit)]">{texte}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Application() {
  return (
    <section id="demo" className="bg-gradient-to-r from-[#fff1e6] to-[#ffe6d2] py-12 lg:py-16">
      <div className={`${conteneur} grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/vitrine/appli.webp"
          alt="Le tableau de bord de Kaya sur ordinateur et l'écran de vente sur téléphone."
          width={595}
          height={350}
          loading="lazy"
          className="h-auto w-full rounded-2xl"
        />
        <div>
          <h2 className="text-3xl font-bold text-[var(--kaya)] sm:text-4xl">
            Une application pensée pour les professionnels
          </h2>
          <p className="mt-4 max-w-[48ch] text-lg text-[var(--nuit)]">
            Rapide, intuitive et fiable, Kaya vous aide à gérer votre
            quincaillerie comme un pro, sans prise de tête.
          </p>
          <ul className="mt-5 flex flex-col gap-3 text-[var(--nuit)]">
            <Coche>Interface moderne et facile à prendre en main</Coche>
            <Coche>Installation comme une application mobile (PWA)</Coche>
            <Coche>Support réactif et accompagnement local</Coche>
          </ul>
          <Link href="/inscription" className={`${boutonOrange} mt-7`}>
            Commencer dès maintenant
            <ArrowRight aria-hidden="true" size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Vrais avis uniquement : tant que la liste est vide, la section n'apparaît pas. */
const TEMOIGNAGES: { texte: string; nom: string; boutique: string }[] = [];

export function Temoignages() {
  if (TEMOIGNAGES.length === 0) return null;
  return (
    <section id="avis" className="bg-white py-12 lg:py-16">
      <div className={conteneur}>
        <Titre sur="Ils nous font confiance" titre="Ce que disent les quincailleries qui utilisent Kaya" />
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {TEMOIGNAGES.map((t) => (
            <li key={t.nom} className="flex flex-col gap-3 rounded-2xl border border-[#f3dcc3] p-5">
              <p className="text-[var(--nuit)]">« {t.texte} »</p>
              <p className="mt-auto font-bold text-[var(--nuit)]">{t.nom}</p>
              <p className="text-sm text-[var(--nuit)]">{t.boutique}</p>
              <p aria-label="5 étoiles sur 5" className="flex gap-1 text-[#f5a000]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} aria-hidden="true" size={18} fill="currentColor" />
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AppelFinal() {
  return (
    <section className="bg-white pb-0">
      <div className="rounded-t-[2.5rem] bg-gradient-to-r from-[#ff8a2a] to-[var(--kaya)] text-white">
        <div className={`${conteneur} flex flex-col items-start gap-6 py-10 md:flex-row md:items-center md:justify-between`}>
          <div className="flex items-center gap-5">
            <Rocket aria-hidden="true" size={52} className="hidden shrink-0 sm:block" />
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Prêt à moderniser votre quincaillerie ?</h2>
              <p className="mt-1 text-lg">Créez votre boutique en quelques minutes, ajoutez un produit, faites une vente.</p>
            </div>
          </div>
          <Link href="/inscription" className={boutonBlanc}>
            Créer ma boutique
            <ArrowRight aria-hidden="true" size={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
