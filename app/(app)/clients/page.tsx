import { ChevronRight, Plus, Users } from "lucide-react";
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
      <Link
        href="/clients/dettes"
        className="border-brand-strong text-brand-strong hover:bg-brand-soft flex min-h-11 items-center justify-between rounded-lg border px-4 font-semibold"
      >
        Qui me doit de l&apos;argent ? <span aria-hidden>→</span>
      </Link>
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
          {page.clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className={`flex min-h-11 items-center gap-3 rounded-2xl border p-3 shadow-sm ${c.dette > 0 ? "border-orange-200 bg-orange-50" : "border-border bg-white"}`}
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
                    <span className="text-muted text-sm">{c.telephone}</span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 text-sm font-bold">
                  <span
                    className={`rounded-full px-3 py-0.5 ${c.dette > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                  >
                    {c.dette > 0 ? "Crédit dû" : "Solde nul"}
                  </span>
                  <span className={c.dette > 0 ? "text-red-700" : ""}>
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
        <div className="grid grid-cols-3 gap-2 text-center text-sm font-semibold">
          <p className="rounded-2xl bg-orange-50 p-3">
            <b className="block text-xl">{page.clients.length}</b>Clients
          </p>
          <p className="rounded-2xl bg-red-50 p-3 text-red-700">
            <b className="block text-xl">{page.clients.filter((c) => c.dette > 0).length}</b>
            Avec crédit
          </p>
          <p className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <b className="block text-xl">{page.clients.filter((c) => c.dette <= 0).length}</b>
            Sans crédit
          </p>
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
