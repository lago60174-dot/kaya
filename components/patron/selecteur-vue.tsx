/** Choix de la vue du tableau de bord : toutes les boutiques ensemble, ou une boutique. Formulaire GET : aucun script. */
export function SelecteurVue({
  boutiques,
  valeur,
}: {
  boutiques: { id: string; nom: string }[];
  /** `toutes` ou l'identifiant d'une boutique. */
  valeur: string;
}) {
  return (
    <form method="get" className="flex items-center gap-2">
      <label htmlFor="boutique" className="text-sm font-medium">
        Vue
      </label>
      <select
        id="boutique"
        name="boutique"
        defaultValue={valeur}
        className="border-border min-h-11 rounded-lg border bg-white px-3"
      >
        <option value="toutes">Toutes les boutiques</option>
        {boutiques.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nom}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="border-border min-h-11 rounded-lg border px-4 text-sm font-medium"
      >
        Afficher
      </button>
    </form>
  );
}
