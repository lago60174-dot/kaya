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
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link
          href="/clients/nouveau"
          className="bg-brand-strong flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white"
        >
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
                className="border-border hover:bg-brand-soft flex min-h-11 items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{c.nom}</span>
                  {c.telephone && (
                    <span className="text-muted text-sm">{c.telephone}</span>
                  )}
                </span>
                {c.dette > 0 && (
                  <span className="bg-danger shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-white">
                    Doit {formatFcfa(c.dette)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
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
