"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { categoriesPour } from "@/lib/caisse/caisse";
import type { Role } from "@/lib/permissions";
import { lireMontant } from "@/lib/stock/quantites";
import { MODES_PAIEMENT, type ModePaiement } from "@/lib/ventes/paiements";
import { enregistrerDepenseAction } from "@/server/caisse/actions";

/** Saisie rapide d'une dépense : montant, catégorie, note. Un double clic ou un nouvel essai ne l'enregistre jamais deux fois. */
export function FormulaireDepense({ role }: { role: Role }) {
  const router = useRouter();
  const categories = categoriesPour(role);
  const [texte, setTexte] = useState("");
  const [categorie, setCategorie] = useState<string>(categories[0].code);
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const tentative = useRef<{ empreinte: string; cle: string } | null>(null);

  const montant = lireMontant(texte);
  const valide = montant !== null && montant > 0;

  async function enregistrer() {
    if (!valide || enCours) return;
    setEnCours(true);
    setErreur(null);
    setConfirmation(null);
    const empreinte = `${montant}|${categorie}|${mode}|${note.trim()}`;
    if (tentative.current?.empreinte !== empreinte)
      tentative.current = { empreinte, cle: crypto.randomUUID() };
    try {
      const r = await enregistrerDepenseAction({
        cle: tentative.current.cle,
        categorie,
        montant,
        mode,
        note: note.trim() || undefined,
      });
      if (r.ok) {
        tentative.current = null;
        setTexte("");
        setNote("");
        setConfirmation("Dépense enregistrée.");
        router.refresh();
      } else setErreur(r.erreur);
    } catch {
      setErreur(
        "Pas de connexion. Rien n'est perdu : réessayez dans un instant.",
      );
    }
    setEnCours(false);
  }

  return (
    <section
      aria-label="Ajouter une dépense"
      className="border-border flex flex-col gap-3 rounded-lg border p-3"
    >
      <h2 className="text-lg font-semibold">Ajouter une dépense</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="montant-depense" className="text-sm font-medium">
          Montant (FCFA)
        </label>
        <input
          id="montant-depense"
          inputMode="numeric"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="0"
          className="border-border min-h-11 w-44 rounded-lg border bg-white px-3 text-lg"
        />
        {texte.trim() !== "" && !valide && (
          <p className="text-danger text-sm">
            Entrez un montant en FCFA, sans décimales.
          </p>
        )}
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-medium">Catégorie</legend>
        {categories.map((c) => (
          <label
            key={c.code}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${categorie === c.code ? "border-brand-strong bg-brand-soft font-semibold" : "border-border"}`}
          >
            <input
              type="radio"
              name="categorie"
              value={c.code}
              checked={categorie === c.code}
              onChange={() => setCategorie(c.code)}
              className="size-4"
            />
            {c.libelle}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 text-sm font-medium">Payée en</legend>
        {MODES_PAIEMENT.map((m) => (
          <label
            key={m.code}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${mode === m.code ? "border-brand-strong bg-brand-soft font-semibold" : "border-border"}`}
          >
            <input
              type="radio"
              name="mode-depense"
              value={m.code}
              checked={mode === m.code}
              onChange={() => setMode(m.code)}
              className="size-4"
            />
            {m.libelle}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="note-depense" className="text-sm font-medium">
          Note (facultatif)
        </label>
        <input
          id="note-depense"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. taxi pour livraison de ciment"
          className="border-border min-h-11 rounded-lg border bg-white px-3"
        />
      </div>
      {erreur && (
        <p role="alert" className="text-danger text-sm">
          {erreur}
        </p>
      )}
      {confirmation && (
        <p role="status" className="text-success text-sm font-medium">
          {confirmation}
        </p>
      )}
      <button
        type="button"
        onClick={enregistrer}
        disabled={!valide || enCours}
        className="bg-brand-strong min-h-12 rounded-lg px-4 text-lg font-bold text-white disabled:opacity-50"
      >
        {enCours ? "Enregistrement…" : "Enregistrer la dépense"}
      </button>
    </section>
  );
}
