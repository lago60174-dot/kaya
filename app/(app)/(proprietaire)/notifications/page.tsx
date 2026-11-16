import Link from "next/link";
import { ActiverPush } from "@/components/notifications/activer-push";
import { PreferencesNotifications } from "@/components/notifications/preferences";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { marquerToutesLuesAction } from "@/server/notifications/actions";
import {
  lirePreferences,
  listerNotifications,
} from "@/server/notifications/lecture";

export const metadata = { title: "Notifications · Kaya" };

const quand = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Douala",
  }).format(new Date(d));

export default async function PageNotifications() {
  await exigerRole("proprietaire");
  const supabase = await supabaseServeur();
  const preferences = await lirePreferences(supabase);
  const notifications = await listerNotifications(supabase, preferences);
  const nonLues = notifications.filter((n) => !n.lue).length;

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {nonLues > 0 && (
          <form action={marquerToutesLuesAction}>
            <button type="submit" className="border-border min-h-11 rounded-lg border px-3 text-sm font-semibold">
              Tout marquer comme lu
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted">
          Aucune alerte pour le moment. Vous serez prévenu ici dès qu&apos;un stock
          est bas, qu&apos;un écart de caisse apparaît ou qu&apos;une vente est annulée.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`border-border rounded-lg border p-3 ${n.lue ? "" : "border-l-brand-strong border-l-4 bg-white"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={n.lue ? "font-medium" : "font-bold"}>
                  {n.titre}
                  {n.critique && <span className="text-danger ml-2 text-xs font-semibold">Critique</span>}
                </p>
                <span className="text-muted shrink-0 text-xs">{quand(n.creeLe)}</span>
              </div>
              {n.corps && <p className="text-sm">{n.corps}</p>}
              {n.lien && (
                <Link href={n.lien} className="text-brand-strong text-sm font-semibold underline">
                  Voir
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Sur ce téléphone</h2>
        <ActiverPush clePublique={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Quand être prévenu ?</h2>
        <p className="text-muted text-sm">
          Choisissez, pour chaque alerte, où la recevoir. Les seuils se règlent à
          côté : stock bas sur la fiche de chaque produit ; remise, écart de caisse
          et plafond de crédit dans{" "}
          <Link href="/parametres" className="underline">Paramètres</Link>.
        </p>
        <PreferencesNotifications valeurs={preferences} />
      </section>
    </div>
  );
}
