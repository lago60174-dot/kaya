import type { BoutiqueAccessible } from "@/lib/boutiques/active";

/** Cases à cocher « boutiques » d'un vendeur (au moins une). Rendu seulement quand le propriétaire a plusieurs boutiques. */
export function CasesBoutiques({
  boutiques,
  cochees,
  idPrefixe,
}: {
  boutiques: BoutiqueAccessible[];
  cochees: string[];
  idPrefixe: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">Boutiques où il travaille</legend>
      {boutiques.map((b) => (
        <label key={b.id} htmlFor={`${idPrefixe}-${b.id}`} className="flex min-h-11 items-center gap-3 text-base">
          <input
            id={`${idPrefixe}-${b.id}`}
            type="checkbox"
            name="boutiques"
            value={b.id}
            defaultChecked={cochees.includes(b.id)}
            className="size-5"
          />
          {b.nom}
        </label>
      ))}
    </fieldset>
  );
}
