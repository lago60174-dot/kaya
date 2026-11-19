"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { totalLigneCommande } from "@/lib/fournisseurs/fournisseurs";
import { formatFcfa } from "@/lib/format";
import { lireMontant, lireQuantite } from "@/lib/stock/quantites";
import type { ProduitVente } from "@/lib/ventes/panier";
import { creerCommandeAction, lireCoutAction } from "@/server/fournisseurs/actions";
import { chercherProduitsVenteAction } from "@/server/ventes/actions";

interface Ligne {
  cle: string;
  produit: ProduitVente;
  uniteId: string;
  quantiteTexte: string;
  prixTexte: string;
}

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

interface Props {
  fournisseurs: { id: string; nom: string }[];
  produitsInitiaux: ProduitVente[];
  fournisseurInitial?: string;
}

/** Nouvelle commande : produits, quantités et prix d'achat par unité de commande. Le stock n'est touché qu'à la réception. */
export function EcranCommande({ fournisseurs, produitsInitiaux, fournisseurInitial }: Props) {
  const router = useRouter();
  const [fournisseurId, setFournisseurId] = useState(fournisseurInitial ?? "");
  const [q, setQ] = useState("");
  const [produits, setProduits] = useState(produitsInitiaux);
  const [, demarrer] = useTransition();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tentative = useRef<{ empreinte: string; cle: string } | null>(null);

  const quantites = lignes.map((l) => lireQuantite(l.quantiteTexte));
  const prix = lignes.map((l) => (l.prixTexte.trim() === "" ? null : lireMontant(l.prixTexte)));
  const valide = lignes.length > 0 && quantites.every((x) => x !== null && x > 0) && prix.every((x) => x !== null);
  const total = lignes.reduce(
    (t, _l, i) => t + (quantites[i] && prix[i] !== null ? totalLigneCommande(quantites[i]!, prix[i]!) : 0),
    0,
  );

  function modifier(cle: string, patch: Partial<Ligne>) {
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  }

  async function ajouter(p: ProduitVente, uniteId: string) {
    const cle = crypto.randomUUID();
    setLignes((ls) => [...ls, { cle, produit: p, uniteId, quantiteTexte: "1", prixTexte: "" }]);
    const unite = p.unites.find((u) => u.id === uniteId);
    const cout = await lireCoutAction(p.id).catch(() => null);
    if (cout !== null && unite) modifier(cle, { prixTexte: String(Math.round(cout * unite.facteur)) });
  }

  async function envoyer() {
    if (!valide || !fournisseurId || enCours) return;
    setEnCours(true);
    setErreur(null);
    const corps = {
      fournisseurId,
      lignes: lignes.map((l, i) => ({
        produitId: l.produit.id,
        uniteId: l.uniteId,
        quantite: quantites[i]!,
        prixAchat: prix[i]!,
      })),
      note,
    };
    const empreinte = JSON.stringify(corps);
    if (tentative.current?.empreinte !== empreinte) tentative.current = { empreinte, cle: crypto.randomUUID() };
    try {
      const r = await creerCommandeAction({ ...corps, cle: tentative.current.cle });
      if (r.ok) {
        router.push(`/fournisseurs/commandes/${r.commandeId}?cree=1`);
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Votre saisie n'est pas perdue : réessayez dans un instant.");
    }
    setEnCours(false);
  }

  return (
    <div className="grid max-w-5xl gap-6 pb-28 lg:grid-cols-2">
      <section aria-label="Produits" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">Nouvelle commande</h1>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Fournisseur
          <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={champ}>
            <option value="">Choisir…</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={q}
          placeholder="Chercher un produit"
          aria-label="Chercher un produit"
          className={champ}
          onChange={(e) => {
            const valeur = e.target.value;
            setQ(valeur);
            clearTimeout(minuteur.current);
            minuteur.current = setTimeout(
              () => demarrer(async () => setProduits(await chercherProduitsVenteAction(valeur))),
              250,
            );
          }}
        />
        {produits.length === 0 ? (
          <p className="bg-brand-soft rounded-lg p-3">{q ? "Aucun produit ne correspond." : "Aucun produit. Ajoutez d'abord des produits."}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {produits.map((p) => (
              <li key={p.id} className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm">
                <p className="font-bold">{p.nom}</p>
                <ul className="flex flex-col gap-1">
                  {p.unites.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{u.nom}</span>
                      <button
                        type="button"
                        aria-label={`Commander ${u.nom} de ${p.nom}`}
                        onClick={() => void ajouter(p, u.id)}
                        className="bg-brand-strong grid size-11 shrink-0 place-items-center rounded-full text-white"
                      >
                        <Plus aria-hidden="true" size={22} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Contenu de la commande" className="flex flex-col gap-3">
        <h2 className="rounded-xl px-4 py-3 text-lg font-bold text-white" style={{ background: "linear-gradient(110deg,#ff8b1a,#f26a0f)" }}>
          Articles ({lignes.length})
        </h2>
        {lignes.length === 0 && <p className="text-muted">Touchez un produit pour l&apos;ajouter.</p>}
        <ul className="flex flex-col gap-2">
          {lignes.map((l, i) => (
            <li key={l.cle} className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{l.produit.nom}</p>
                <button
                  type="button"
                  aria-label={`Retirer ${l.produit.nom}`}
                  onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                  className="grid size-11 place-items-center rounded-full border border-orange-200 bg-orange-50 text-orange-700"
                >
                  <Trash2 aria-hidden="true" size={20} />
                </button>
              </div>
              <select
                aria-label="Unité"
                value={l.uniteId}
                onChange={(e) => modifier(l.cle, { uniteId: e.target.value })}
                className={champ}
              >
                {l.produit.unites.map((u) => (
                  <option key={u.id} value={u.id}>{u.nom}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
                  Quantité
                  <input
                    inputMode="decimal"
                    value={l.quantiteTexte}
                    onChange={(e) => modifier(l.cle, { quantiteTexte: e.target.value })}
                    aria-invalid={quantites[i] === null}
                    className={champ}
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
                  Prix d&apos;achat (FCFA)
                  <input
                    inputMode="numeric"
                    value={l.prixTexte}
                    onChange={(e) => modifier(l.cle, { prixTexte: e.target.value })}
                    aria-invalid={prix[i] === null}
                    className={champ}
                  />
                </label>
              </div>
              {quantites[i] && prix[i] !== null && (
                <p className="text-right text-sm font-semibold">{formatFcfa(totalLigneCommande(quantites[i]!, prix[i]!))}</p>
              )}
            </li>
          ))}
        </ul>
        {lignes.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Note pour le fournisseur (facultatif)
            <textarea value={note} rows={2} maxLength={300} onChange={(e) => setNote(e.target.value)} className={`${champ} py-2`} />
          </label>
        )}
      </section>

      <div className="border-border bg-background fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-10 border-t p-3 md:bottom-0 md:left-56">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          {erreur && <p role="alert" className="text-danger text-sm">{erreur}</p>}
          {lignes.length > 0 && !valide && <p role="alert" className="text-danger text-sm">Vérifiez les quantités et les prix d&apos;achat.</p>}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-muted text-sm">Total de la commande</p>
              <p className="text-2xl font-bold">{formatFcfa(total)}</p>
            </div>
            <button
              type="button"
              onClick={envoyer}
              disabled={!valide || !fournisseurId || enCours}
              className="bg-brand-strong min-h-12 rounded-lg px-5 font-bold text-white disabled:opacity-50"
            >
              {enCours ? "Enregistrement…" : "Passer la commande"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
