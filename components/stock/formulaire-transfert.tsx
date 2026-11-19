"use client";

import { useEffect, useState } from "react";
import type { BoutiqueAccessible } from "@/lib/boutiques/active";
import { formatQuantite } from "@/lib/format";
import { enUniteDeBase, lireQuantite } from "@/lib/stock/transfert";
import {
  chercherProduitsTransfertAction,
  transfererStockAction,
  type ProduitTransfert,
} from "@/server/stock/transfert";

interface LigneSaisie {
  produit: ProduitTransfert;
  uniteId: string; // "" = unité de base
  quantite: string;
}

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

/** Composition d'un transfert : boutique d'origine et de destination, produits, quantités. */
export function FormulaireTransfert({
  boutiques,
  sourceInitiale,
}: {
  boutiques: BoutiqueAccessible[];
  sourceInitiale: string;
}) {
  const choisissables = boutiques.filter((b) => b.enEcriture);
  const [source, setSource] = useState(sourceInitiale);
  const [destination, setDestination] = useState(
    choisissables.find((b) => b.id !== sourceInitiale)?.id ?? "",
  );
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ProduitTransfert[]>([]);
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [note, setNote] = useState("");
  // Même clé tant que le transfert n'a pas abouti : un nouvel essai après coupure ne le fait pas deux fois.
  const [cle, setCle] = useState(() => crypto.randomUUID());
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    const minuteur = setTimeout(async () => {
      const r = await chercherProduitsTransfertAction(source, recherche).catch(() => []);
      if (!annule) setResultats(r);
    }, 300);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [source, recherche]);

  function changerSource(id: string) {
    setSource(id);
    setLignes([]); // les stocks disponibles sont ceux de l'ancienne boutique
    if (id === destination)
      setDestination(choisissables.find((b) => b.id !== id)?.id ?? "");
  }

  function ajouter(p: ProduitTransfert) {
    setSucces(null);
    setLignes((l) =>
      l.some((x) => x.produit.id === p.id) ? l : [...l, { produit: p, uniteId: "", quantite: "" }],
    );
  }

  const facteur = (l: LigneSaisie) =>
    l.uniteId ? (l.produit.unites.find((u) => u.id === l.uniteId)?.facteur ?? 1) : 1;
  const depasse = (l: LigneSaisie) => {
    const q = lireQuantite(l.quantite);
    return q !== null && enUniteDeBase(q, facteur(l)) > l.produit.stock;
  };

  async function envoyer() {
    setErreur(null);
    setSucces(null);
    const saisies = [];
    for (const l of lignes) {
      const q = lireQuantite(l.quantite);
      if (q === null) return setErreur(`Indiquez une quantité valide pour « ${l.produit.nom} ».`);
      if (depasse(l)) return setErreur(`Il n'y a pas assez de « ${l.produit.nom} » dans la boutique d'origine.`);
      saisies.push({ produitId: l.produit.id, uniteId: l.uniteId || null, quantite: q });
    }
    setEnvoi(true);
    try {
      const r = await transfererStockAction({
        source,
        destination,
        cle,
        note: note.trim() || undefined,
        lignes: saisies,
      });
      if (r.ok) {
        setSucces(r.message);
        setLignes([]);
        setNote("");
        setCle(crypto.randomUUID());
        setRecherche("");
      } else setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Rien n'est perdu : réessayez dans un instant.");
    }
    setEnvoi(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          De la boutique
          <select value={source} onChange={(e) => changerSource(e.target.value)} className={champ}>
            {choisissables.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Vers la boutique
          <select value={destination} onChange={(e) => setDestination(e.target.value)} className={champ}>
            {choisissables.filter((b) => b.id !== source).map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Produits à transférer</h2>
        {lignes.length === 0 && (
          <p className="text-muted text-sm">Cherchez un produit ci-dessous et touchez « Ajouter ».</p>
        )}
        <ul className="flex flex-col gap-3">
          {lignes.map((l) => {
            const unites = [
              { id: "", nom: l.produit.uniteBase },
              ...l.produit.unites.filter((u) => u.nom !== l.produit.uniteBase),
            ];
            return (
              <li key={l.produit.id} className="border-border flex flex-col gap-2 rounded-xl border bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{l.produit.nom}</p>
                    <p className="text-muted text-sm">
                      Disponible : {formatQuantite(l.produit.stock)} {l.produit.uniteBase}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLignes((x) => x.filter((y) => y.produit.id !== l.produit.id))}
                    className="text-danger min-h-11 shrink-0 text-sm font-semibold underline"
                  >
                    Retirer
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    inputMode="decimal"
                    value={l.quantite}
                    onChange={(e) =>
                      setLignes((x) => x.map((y) => (y.produit.id === l.produit.id ? { ...y, quantite: e.target.value } : y)))
                    }
                    aria-label={`Quantité de ${l.produit.nom}`}
                    placeholder="Quantité"
                    className={`${champ} min-w-0 flex-1`}
                  />
                  <select
                    value={l.uniteId}
                    onChange={(e) =>
                      setLignes((x) => x.map((y) => (y.produit.id === l.produit.id ? { ...y, uniteId: e.target.value } : y)))
                    }
                    aria-label={`Unité de ${l.produit.nom}`}
                    className={champ}
                  >
                    {unites.map((u) => (
                      <option key={u.id} value={u.id}>{u.nom}</option>
                    ))}
                  </select>
                </div>
                {depasse(l) && (
                  <p role="alert" className="text-danger text-sm">Plus que le stock disponible.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="recherche-transfert" className="text-sm font-medium">Chercher un produit</label>
        <input
          id="recherche-transfert"
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Ciment, fer, peinture…"
          className={champ}
        />
        <ul className="flex flex-col gap-2">
          {resultats.slice(0, 12).map((p) => {
            const deja = lignes.some((l) => l.produit.id === p.id);
            return (
              <li key={p.id} className="border-border flex items-center justify-between gap-3 rounded-xl border bg-white p-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.nom}</span>
                  <span className="text-muted text-sm">{formatQuantite(p.stock)} {p.uniteBase} en stock</span>
                </span>
                <button
                  type="button"
                  disabled={deja}
                  onClick={() => ajouter(p)}
                  className="border-border min-h-11 shrink-0 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {deja ? "Ajouté" : "Ajouter"}
                </button>
              </li>
            );
          })}
          {resultats.length === 0 && (
            <li className="text-muted text-sm">Aucun produit en stock dans cette boutique pour cette recherche.</li>
          )}
        </ul>
      </section>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Note (facultatif)
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex. livraison du lundi" className={champ} />
      </label>

      {erreur && <p role="alert" className="text-danger text-sm">{erreur}</p>}
      {succes && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{succes}</p>
      )}
      <button
        type="button"
        onClick={envoyer}
        disabled={envoi || lignes.length === 0 || !destination}
        className="bg-brand-strong min-h-12 rounded-xl px-6 text-base font-bold text-white disabled:opacity-60"
      >
        {envoi ? "Transfert en cours…" : "Transférer le stock"}
      </button>
    </div>
  );
}
