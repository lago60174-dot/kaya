import Link from "next/link";
import { bandeauAbonnement, etatDepuisSql } from "@/lib/abonnement/etat";
import { supabaseServeur } from "@/lib/supabase/server";

const STYLE = {
  info: "bg-brand-soft",
  alerte: "bg-brand-soft",
  blocage: "bg-danger text-white",
} as const;

/** Bandeau en haut de l'écran pour tous les membres : essai qui finit, retard, lecture seule. Rien si tout va bien. */
export async function BandeauAbonnement({
  estProprietaire,
}: {
  estProprietaire: boolean;
}) {
  const { data } = await (await supabaseServeur()).rpc("abonnement_statut");
  const etat = etatDepuisSql(data);
  const bandeau = etat && bandeauAbonnement(etat, new Date());
  if (!bandeau) return null;
  return (
    <div
      role={bandeau.ton === "info" ? "status" : "alert"}
      className={`${STYLE[bandeau.ton]} flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm`}
    >
      <span className="flex-1">{bandeau.message}</span>
      {estProprietaire ? (
        <Link href="/parametres#abonnement" className="font-semibold underline">
          Régler
        </Link>
      ) : (
        <span>Prévenez le propriétaire.</span>
      )}
    </div>
  );
}
