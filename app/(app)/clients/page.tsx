import { Check, ChevronRight, Phone, Plus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { RechercheSimple } from "@/components/recherche-simple";
import { formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { listerClients } from "@/server/clients/lecture";

export const metadata = { title: "Clients · Kaya" };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PageClients({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profil = await exigerRole("boutique");
  const p = await searchParams;
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;

  const recherche = p.q?.trim().slice(0, 60) || undefined;
  const page = await listerClients(await supabaseServeur(), boutiqueId, {
    recherche,
    ...(p.apres_nom && p.apres_id && UUID.test(p.apres_id)
      ? { apresNom: p.apres_nom.slice(0, 100), apresId: p.apres_id }
      : {}),
  });
  const credit = p.credit === "avec" || p.credit === "sans" ? p.credit : null;
  const tri = p.tri === "dette" ? "dette" : "nom";
  const visibles = page.clients
    .filter((c) => (credit === "avec" ? c.dette > 0 : credit === "sans" ? c.dette <= 0 : true))
    .sort((a, b) => (tri === "dette" ? b.dette - a.dette : 0));
  const lien = (extra: Record<string, string>) =>
    `/clients?${new URLSearchParams({ ...(recherche ? { q: recherche } : {}), ...(credit ? { credit } : {}), ...(tri === "dette" ? { tri } : {}), ...extra })}`;
  const suite = page.suivant
    ? new URLSearchParams({
        ...(recherche ? { q: recherche } : {}),
        apres_nom: page.suivant.nom,
        apres_id: page.suivant.id,
      })
    : null;

  return (
    <div className="kaya-clients-page flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <Users aria-hidden="true" size={26} />
          </span>
          <div>
            <h1 className="text-xl font-bold">Clients &amp; Crédits</h1>
            <p className="text-muted text-sm">Gérez vos clients et leurs dettes</p>
          </div>
        </div>
        <Link
          href="/clients/nouveau"
          className="bg-brand-strong flex min-h-11 shrink-0 items-center gap-1 rounded-full px-4 text-sm font-semibold text-white"
        >
          <Plus aria-hidden="true" size={18} />
          Nouveau client
        </Link>
      </div>
      <nav aria-label="Filtrer les clients" className="flex flex-wrap gap-2">
        {([[null, "Tous"], ["avec", "Avec crédit"], ["sans", "Sans crédit"]] as const).map(([code, libelle]) => (
          <Link
            key={libelle}
            href={`/clients?${new URLSearchParams({ ...(recherche ? { q: recherche } : {}), ...(code ? { credit: code } : {}), ...(tri === "dette" ? { tri } : {}) })}`}
            aria-current={credit === code ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${credit === code ? "bg-orange-500 text-white" : "border-border border bg-white"}`}
          >
            {libelle}
          </Link>
        ))}
        <Link
          href={tri === "dette" ? lien({ tri: "nom" }).replace("&tri=nom", "").replace("?tri=nom", "") : lien({ tri: "dette" })}
          className="border-border flex min-h-11 items-center rounded-full border bg-white px-5 text-sm font-bold"
        >
          {tri === "dette" ? "Tri : plus gros crédit d'abord" : "Trier par crédit"}
        </Link>
      </nav>
      <RechercheSimple
        chemin="/clients"
        placeholder="Chercher un client (nom ou téléphone)"
      />
      {page.clients.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          {recherche
            ? "Aucun client ne correspond à votre recherche."
            : "Aucun client. Ajoutez votre premier client."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="border-border flex min-h-11 items-center gap-3 rounded-2xl border p-3 shadow-sm"
                style={{ background: c.dette > 0 ? "#fdeee3" : "#fff" }}
              >
                <span
                  aria-hidden="true"
                  className="grid size-14 shrink-0 place-items-center rounded-full bg-orange-100 text-xl font-bold text-orange-700"
                >
                  {c.nom.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-bold">{c.nom}</span>
                  {c.telephone && (
                    <span className="text-muted flex items-center gap-1 text-sm">
                      <Phone aria-hidden="true" size={14} />
                      {c.telephone}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 text-sm font-bold">
                  <span
                    className={`rounded-full px-3 py-0.5 ${c.dette > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                  >
                    {c.dette > 0 ? "Crédit dû" : "Solde nul"}
                  </span>
                  <span className={c.dette > 0 ? "rounded-full bg-red-100 px-3 py-1 text-base text-red-700" : ""}>
                    {formatFcfa(c.dette)}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={18} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!suite && !recherche && page.clients.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
          {[
            [Users, page.clients.length, "Clients", "#fdeee3", "#c2410c"],
            [Wallet, page.clients.filter((c) => c.dette > 0).length, "Avec crédit", "#fde4e4", "#b91c1c"],
            [Check, page.clients.filter((c) => c.dette <= 0).length, "Sans crédit", "#dff4e7", "#15803d"],
          ].map(([Icone, n, libelle, fond, couleur]) => {
            const I = Icone as typeof Users;
            return (
              <p key={String(libelle)} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: String(fond) }}>
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-white" style={{ color: String(couleur) }}>
                  <I size={20} />
                </span>
                <span>
                  <b className="block text-xl">{String(n)}</b>
                  {String(libelle)}
                </span>
              </p>
            );
          })}
        </div>
      )}
      {suite && (
        <Link
          href={`/clients?${suite}`}
          className="border-border flex min-h-11 items-center justify-center rounded-lg border font-medium"
        >
          Voir la suite
        </Link>
      )}
    </div>
  );
}
