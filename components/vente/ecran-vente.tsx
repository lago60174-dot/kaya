"use client";

import { Plus, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatFcfa } from "@/lib/format";
import { formaterStock, lireMontant } from "@/lib/stock/quantites";
import {
  ajouterAuPanier,
  calculerTotaux,
  changerQuantite,
  changerUnite,
  lignesEnRupture,
  remiseAutorisee,
  retirerDuPanier,
  type LignePanier,
  type ProduitVente,
} from "@/lib/ventes/panier";
import { preparerPaiements, type LignePaiement } from "@/lib/ventes/paiements";
import {
  chercherProduitsVenteAction,
  validerVenteAction,
  type ClientTrouve,
} from "@/server/ventes/actions";
import { LigneDuPanier } from "./ligne-panier";
import { PaiementsVente } from "./paiements-vente";
import { SelecteurClient } from "./selecteur-client";

interface Props {
  role: "proprietaire" | "vendeur";
  seuilRemise: number;
  produitsInitiaux: ProduitVente[];
}

export function EcranVente({ role, seuilRemise, produitsInitiaux }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [produits, setProduits] = useState(produitsInitiaux);
  const [categorie, setCategorie] = useState<string | null>(null);
  const categories = [
    ...new Set(produitsInitiaux.map((p) => p.categorie).filter((c): c is string => !!c)),
  ];
  const visibles = categorie ? produits.filter((p) => p.categorie === categorie) : produits;
  const [, demarrer] = useTransition();
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [remiseTexte, setRemiseTexte] = useState("");
  const [client, setClient] = useState<ClientTrouve | null>(null);
  const [credit, setCredit] = useState(false);
  const [paiements, setPaiements] = useState<LignePaiement[]>([
    { mode: "especes", montant: "" },
  ]);
  const [forcer, setForcer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Même contenu = même clé (un nouvel essai après coupure ne crée jamais de doublon). Contenu modifié = nouvelle clé.
  const tentative = useRef<{ empreinte: string; cle: string } | null>(null);

  const remiseGlobale =
    remiseTexte.trim() === "" ? 0 : lireMontant(remiseTexte);
  const totaux = calculerTotaux(lignes, remiseGlobale ?? 0);
  const preparation = preparerPaiements(paiements, credit, totaux.total);
  const ruptures = lignesEnRupture(lignes);
  const verifRemise = remiseAutorisee(role, seuilRemise, totaux);

  let probleme: string | null = null;
  if (remiseGlobale === null)
    probleme = "Entrez la remise en FCFA, sans décimales.";
  else if (!verifRemise.ok) probleme = verifRemise.message;
  else if (credit && !client)
    probleme = "Choisissez un client pour vendre à crédit.";
  else if (!preparation.ok) probleme = preparation.erreur;
  const peutValider = lignes.length > 0 && probleme === null && !enCours;

  async function valider() {
    if (!peutValider || !preparation.ok) return;
    setEnCours(true);
    setErreur(null);
    const corps = {
      lignes: lignes.map((l) => ({
        produitId: l.produit.id,
        uniteId: l.uniteId,
        quantite: l.quantite,
        remiseLigne: l.remiseLigne,
      })),
      paiements: preparation.paiements,
      clientId: client?.id ?? null,
      remise: remiseGlobale ?? 0,
      forcer: credit && forcer,
    };
    const empreinte = JSON.stringify(corps);
    if (tentative.current?.empreinte !== empreinte)
      tentative.current = { empreinte, cle: crypto.randomUUID() };
    try {
      const r = await validerVenteAction({
        ...corps,
        cle: tentative.current.cle,
      });
      if (r.ok) {
        router.push(`/vente/recu/${r.venteId}?succes=1`);
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur(
        "Pas de connexion. Votre vente n'est pas perdue : réessayez dans un instant.",
      );
    }
    setEnCours(false);
  }

  const cle = () => crypto.randomUUID();

  return (
    <div className="kaya-sale grid max-w-5xl gap-6 pb-28 lg:grid-cols-2">
      <section aria-label="Produits" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <ShoppingCart aria-hidden="true" size={26} />
          </span>
          <div>
            <h1 className="text-xl font-bold">Nouvelle vente</h1>
            <p className="text-muted text-sm">Rapide, simple et sécurisé</p>
          </div>
        </div>
        <input
          type="search"
          value={q}
          placeholder="Chercher un produit ou une marque"
          aria-label="Chercher un produit ou une marque"
          className="border-border min-h-11 rounded-lg border bg-white px-3 text-base"
          onChange={(e) => {
            const valeur = e.target.value;
            setQ(valeur);
            clearTimeout(minuteur.current);
            minuteur.current = setTimeout(
              () =>
                demarrer(async () =>
                  setProduits(await chercherProduitsVenteAction(valeur)),
                ),
              250,
            );
          }}
        />
        {produits.length === 0 ? (
          <p className="bg-brand-soft rounded-lg p-3">
            {q
              ? "Aucun produit ne correspond."
              : "Aucun produit à vendre. Le propriétaire doit d'abord ajouter des produits."}
          </p>
        ) : (
          <>
          {categories.length > 0 && (
            <div role="group" aria-label="Catégorie" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? "tout"}
                  type="button"
                  aria-pressed={categorie === c}
                  onClick={() => setCategorie(c)}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${categorie === c ? "bg-orange-500 text-white" : "border-border border bg-white"}`}
                >
                  {c ?? "Tout"}
                </button>
              ))}
            </div>
          )}
          <ul className="grid grid-cols-2 gap-3">
            {visibles.map((p) => (
              <li
                key={p.id}
                className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm"
              >
                {p.vignette ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/img/${p.vignette}`}
                    alt=""
                    width={160}
                    height={112}
                    loading="lazy"
                    className="h-28 w-full rounded-xl bg-[#faf5f0] object-contain"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="bg-brand-soft text-brand-strong grid h-28 place-items-center rounded-xl text-3xl font-extrabold"
                  >
                    {p.nom.charAt(0)}
                  </span>
                )}
                <p className="font-bold">{p.nom}</p>
                <p className="text-muted text-sm">
                  En stock : {formaterStock(p.stock, p.uniteBase, p.unites)}
                </p>
                <ul className="flex flex-col gap-2">
                  {p.unites.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{u.nom}</span>
                        <b className="block">{formatFcfa(u.prixVente)}</b>
                      </span>
                      <button
                        type="button"
                        aria-label={`Ajouter ${u.nom} au panier`}
                        onClick={() => setLignes((l) => ajouterAuPanier(l, p, u.id, cle))}
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
          </>
        )}
      </section>

      <section aria-label="Panier" className="flex flex-col gap-4">
        <h2
          className="rounded-xl px-4 py-3 text-lg font-bold text-white"
          style={{ background: "linear-gradient(110deg,#ff8b1a,#f26a0f)" }}
        >
          Panier ({lignes.length})
        </h2>
        {lignes.length === 0 ? (
          <p className="text-muted">Touchez un produit pour l&apos;ajouter.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lignes.map((l) => (
              <LigneDuPanier
                key={l.cle}
                ligne={l}
                onQuantite={(v) =>
                  setLignes((x) => changerQuantite(x, l.cle, v))
                }
                onUnite={(id) => setLignes((x) => changerUnite(x, l.cle, id))}
                onRetirer={() => setLignes((x) => retirerDuPanier(x, l.cle))}
              />
            ))}
          </ul>
        )}
        {ruptures.map((r) => (
          <p
            key={r.produitId}
            role="status"
            className="bg-brand-soft rounded-lg p-2 text-sm"
          >
            Attention : {r.nom}, il reste{" "}
            {formaterStock(r.stock, r.uniteBase, [])} pour{" "}
            {formaterStock(r.demande, r.uniteBase, [])} demandés.
          </p>
        ))}

        {lignes.length > 0 && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="remise" className="text-sm font-medium">
                Remise (FCFA)
                {role === "vendeur" && ` · maximum ${seuilRemise} %`}
              </label>
              <input
                id="remise"
                inputMode="numeric"
                value={remiseTexte}
                onChange={(e) => setRemiseTexte(e.target.value)}
                placeholder="0"
                className="border-border min-h-11 w-40 rounded-lg border bg-white px-3 text-base"
              />
            </div>
            <SelecteurClient
              client={client}
              onChoisir={setClient}
              obligatoire={credit}
            />
            <PaiementsVente
              lignes={paiements}
              onChange={setPaiements}
              credit={credit}
              onCredit={setCredit}
              total={totaux.total}
              peutForcer={role === "proprietaire"}
              forcer={forcer}
              onForcer={setForcer}
            />
            {credit && preparation.ok && (
              <p className="font-medium">
                Crédit : {formatFcfa(preparation.credit)} à payer plus tard
              </p>
            )}
          </>
        )}
      </section>

      <div className="border-border bg-background fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-10 border-t p-3 md:bottom-0 md:left-56">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          {(erreur ?? probleme) && lignes.length > 0 && (
            <p role="alert" className="text-danger text-sm">
              {erreur ?? probleme}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-muted text-sm">
                Total
                {totaux.remise > 0 && ` (remise ${formatFcfa(totaux.remise)})`}
              </p>
              <p className="text-2xl font-bold">{formatFcfa(totaux.total)}</p>
            </div>
            <button
              type="button"
              onClick={valider}
              disabled={!peutValider}
              className="bg-brand-strong min-h-12 flex-1 rounded-lg px-4 text-lg font-bold text-white disabled:opacity-50 sm:flex-none sm:px-10"
            >
              {enCours ? "Enregistrement…" : "Valider la vente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
