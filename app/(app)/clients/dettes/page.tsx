import Link from "next/link";
import {
  ancienneteJours,
  detteAncienne,
  libelleAnciennete,
} from "@/lib/clients/credit";
import { messageRappel } from "@/lib/clients/messages";
import { formatFcfa } from "@/lib/format";
import { supabaseServeur } from "@/lib/supabase/server";
import { lienWhatsApp } from "@/lib/ventes/whatsapp";
import { exigerRole } from "@/server/auth/session";
import { listerDettes } from "@/server/clients/lecture";

export const metadata = { title: "Qui me doit de l'argent · Kaya" };

const PAGE = 30;

export default async function PageDettes({
  searchParams,
}: {
  searchParams: Promise<{ tri?: string; decalage?: string }>;
}) {
  const profil = await exigerRole("boutique");
  const p = await searchParams;
  const boutiqueId = profil.boutiqueIds[0];
  if (!boutiqueId)
    return <p>Aucune boutique n&apos;est associée à votre compte.</p>;

  const tri = p.tri === "anciennete" ? "anciennete" : "montant";
  const decalage = Math.max(
    0,
    Math.min(100_000, Number.parseInt(p.decalage ?? "0", 10) || 0),
  );
  const supabase = await supabaseServeur();
  const [res, boutique] = await Promise.all([
    listerDettes(supabase, boutiqueId, tri, decalage),
    supabase.from("boutiques").select("nom").eq("id", boutiqueId).maybeSingle(),
  ]);
  const lien = (t: string, d = 0) =>
    `/clients/dettes?tri=${t}${d ? `&decalage=${d}` : ""}`;
  const onglet = (actif: boolean) =>
    `flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${actif ? "border-brand-strong bg-brand-soft" : "border-border"}`;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Qui me doit de l&apos;argent ?</h1>
      <div className="bg-brand-soft rounded-lg p-4">
        <p className="text-muted text-sm">Total des dettes</p>
        <p className="text-3xl font-bold">{formatFcfa(res.totalDettes)}</p>
        <p className="text-muted text-sm">
          {res.totalClients} client{res.totalClients > 1 ? "s" : ""}
        </p>
      </div>
      <nav aria-label="Tri" className="flex flex-wrap gap-2">
        <Link
          href={lien("montant")}
          className={onglet(tri === "montant")}
          aria-current={tri === "montant" ? "page" : undefined}
        >
          Plus gros montants
        </Link>
        <Link
          href={lien("anciennete")}
          className={onglet(tri === "anciennete")}
          aria-current={tri === "anciennete" ? "page" : undefined}
        >
          Plus anciennes dettes
        </Link>
      </nav>
      {res.clients.length === 0 ? (
        <p className="bg-brand-soft rounded-lg p-4">
          Personne ne vous doit d&apos;argent. Bravo !
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {res.clients.map((c) => {
            const jours = ancienneteJours(c.plus_ancienne);
            const message = messageRappel({
              boutique: boutique.data?.nom ?? "",
              client: c.nom,
              dette: c.dette,
            });
            return (
              <li
                key={c.client_id}
                className="border-border flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/clients/${c.client_id}`}
                    className="min-w-0 font-medium hover:underline"
                  >
                    {c.nom}
                  </Link>
                  <span className="shrink-0 text-lg font-bold">
                    {formatFcfa(c.dette)}
                  </span>
                </div>
                <p
                  className={`text-sm ${detteAncienne(jours) ? "text-danger font-semibold" : "text-muted"}`}
                >
                  Dette {libelleAnciennete(jours)} · {c.nb_ventes} vente
                  {c.nb_ventes > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={lienWhatsApp(c.telephone, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-success flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-white"
                  >
                    Rappeler sur WhatsApp
                  </a>
                  <Link
                    href={`/clients/${c.client_id}#paiement`}
                    className="border-border flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold"
                  >
                    Encaisser
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {decalage + PAGE < res.totalClients && (
        <Link
          href={lien(tri, decalage + PAGE)}
          className="border-border flex min-h-11 items-center justify-center rounded-lg border font-medium"
        >
          Voir la suite
        </Link>
      )}
    </div>
  );
}
