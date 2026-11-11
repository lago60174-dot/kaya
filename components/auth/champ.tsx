import type { ComponentProps } from "react";

interface Props extends ComponentProps<"input"> {
  nom: string;
  /** Identifiant HTML, quand plusieurs formulaires de la page ont un champ du même nom. */
  idChamp?: string;
  libelle: string;
  erreur?: string;
  aide?: string;
}

export function Champ({
  nom,
  idChamp,
  libelle,
  erreur,
  aide,
  ...reste
}: Props) {
  const id = idChamp ?? nom;
  const idAide = `${id}-aide`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {libelle}
      </label>
      <input
        id={id}
        name={nom}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur || aide ? idAide : undefined}
        className="border-border focus:border-brand-strong focus:outline-brand rounded-lg border bg-white px-3 text-base focus:outline-2"
        {...reste}
      />
      {(erreur || aide) && (
        <p
          id={idAide}
          className={erreur ? "text-danger text-sm" : "text-muted text-sm"}
        >
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}
