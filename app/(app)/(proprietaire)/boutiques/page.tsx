import { Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BoutonChoisirBoutique } from "@/components/boutiques/bouton-choisir";
import { FormulaireBoutique } from "@/components/boutiques/formulaire-boutique";
import { limite, peutUtiliser } from "@/lib/plans";
import { exigerRole } from "@/server/auth/session";

export const metadata = { title: "Boutiques · Kaya" };

export default async function PageBoutiques() {
  const profil = await exigerRole("proprietaire");
  // Une fonction absente du plan n'existe pas : pas de page, même en tapant l'adresse à la main.
  if (!profil.plan || !peutUtiliser(profil.plan, "multi_boutiques"))
    redirect("/patron");
  const max = limite(profil.plan, "boutiques");
  const nb = profil.boutiques.length;
  const peutAjouter = max === null || nb < max;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Mes boutiques</h1>
        <p className="text-muted text-sm">
          {nb} boutique{nb > 1 ? "s" : ""}
          {max !== null ? ` sur ${max} permise${max > 1 ? "s" : ""} par votre abonnement` : ""}.
          Chaque boutique a son stock, sa caisse et ses reçus. Les produits et
          les clients sont communs.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {profil.boutiques.map((b) => (
          <li key={b.id} className="border-border flex flex-col gap-3 rounded-2xl border bg-white p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
                <Store size={22} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold">{b.nom}</p>
                {b.adresse && <p className="text-muted text-sm">{b.adresse}</p>}
                {b.telephone && <p className="text-muted text-sm">{b.telephone}</p>}
                <p className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                  {b.id === profil.boutiqueActiveId && (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Vous êtes ici</span>
                  )}
                  {!b.enEcriture && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Lecture seule : au-delà de votre abonnement</span>
                  )}
                </p>
              </div>
            </div>
            {b.id !== profil.boutiqueActiveId && <BoutonChoisirBoutique boutiqueId={b.id} />}
          </li>
        ))}
      </ul>

      {nb > 1 && (
        <Link href="/stock/transfert" className="border-border flex min-h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-bold">
          Transférer du stock entre boutiques
        </Link>
      )}

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Ajouter une boutique</h2>
        {peutAjouter ? (
          <FormulaireBoutique />
        ) : (
          <p className="bg-brand-soft rounded-lg p-3 text-sm">
            Votre abonnement permet {max} boutique{max !== null && max > 1 ? "s" : ""}.
            Contactez-nous pour en ajouter d&apos;autres.
          </p>
        )}
      </section>
    </div>
  );
}
