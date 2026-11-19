"use client";

import { FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SelecteurClient } from "@/components/vente/selecteur-client";
import { LigneDuPanier } from "@/components/vente/ligne-panier";
import {
  libelleTypeDevis,
  type TypeDevis,
} from "@/lib/devis/devis";
import { formatFcfa } from "@/lib/format";
import { formaterStock, lireMontant } from "@/lib/stock/quantites";
import {
  ajouterAuPanier,
  calculerTotaux,
  changerQuantite,
  changerUnite,
  retirerDuPanier,
  type LignePanier,
  type ProduitVente,
} from "@/lib/ventes/panier";
import { enregistrerDevisAction } from "@/server/devis/actions";
import {
  chercherProduitsVenteAction,
  type ClientTrouve,
} from "@/server/ventes/actions";

export interface DevisInitial {
  id: string;
  type: TypeDevis;
  client: ClientTrouve | null;
  lignes: LignePanier[];
  remise: number;
  valideJusqu: string;
  conditions: string;
  note: string;
}

interface Props {
  initial?: DevisInitial;
  produitsInitiaux: ProduitVente[];
  /** Jour courant à Douala (AAAA-MM-JJ) : date minimale de validité. */
  aujourdhui: string;
  /** Validité proposée pour un nouveau devis. */
  validiteDefaut: string;
  /** Nombre de lignes retirées parce que l'article n'est plus en vente (modification d'un brouillon). */
  lignesPerdues?: number;
  typeInitial?: TypeDevis;
}

const champ = "border-border min-h-11 rounded-lg border bg-white px-3 text-base";

export function EcranDevis({
  initial,
  produitsInitiaux,
  aujourdhui,
  validiteDefaut,
  lignesPerdues = 0,
  typeInitial = "devis",
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<TypeDevis>(initial?.type ?? typeInitial);
  const [q, setQ] = useState("");
  const [produits, setProduits] = useState(produitsInitiaux);
  const [, demarrer] = useTransition();
  const [lignes, setLignes] = useState<LignePanier[]>(initial?.lignes ?? []);
  const [remiseTexte, setRemiseTexte] = useState(
    initial && initial.remise > 0 ? String(initial.remise) : "",
  );
  const [client, setClient] = useState<ClientTrouve | null>(initial?.client ?? null);
  const [valideJusqu, setValideJusqu] = useState(initial?.valideJusqu ?? validiteDefaut);
  const [conditions, setConditions] = useState(initial?.conditions ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Même contenu = même clé : un nouvel essai après coupure ne crée jamais de doublon.
  const tentative = useRef<{ empreinte: string; cle: string } | null>(null);

  const remise = remiseTexte.trim() === "" ? 0 : lireMontant(remiseTexte);
  const totaux = calculerTotaux(lignes, remise ?? 0);

  let probleme: string | null = null;
  if (remise === null) probleme = "Entrez la remise en FCFA, sans décimales.";
  else if (lignes.length > 0 && totaux.total <= 0)
    probleme = "La remise ne peut pas couvrir tout le prix.";
  else if (!valideJusqu || valideJusqu < aujourdhui)
    probleme = "Choisissez une date de validité à partir d'aujourd'hui.";
  const peutEnregistrer = lignes.length > 0 && probleme === null && !enCours;

  async function enregistrer(envoyer: boolean) {
    if (!peutEnregistrer) return;
    setEnCours(true);
    setErreur(null);
    const corps = {
      id: initial?.id ?? null,
      type,
      clientId: client?.id ?? null,
      lignes: lignes.map((l) => ({
        produitId: l.produit.id,
        uniteId: l.uniteId,
        quantite: l.quantite,
      })),
      remise: remise ?? 0,
      valideJusqu,
      conditions,
      note,
      envoyer,
    };
    const empreinte = JSON.stringify(corps);
    if (tentative.current?.empreinte !== empreinte)
      tentative.current = { empreinte, cle: crypto.randomUUID() };
    try {
      const r = await enregistrerDevisAction({ ...corps, cle: tentative.current.cle });
      if (r.ok) {
        router.push(`/devis/${r.devisId}${envoyer ? "?envoye=1" : ""}`);
        return;
      }
      setErreur(r.erreur);
    } catch {
      setErreur("Pas de connexion. Votre saisie n'est pas perdue : réessayez dans un instant.");
    }
    setConfirmer(false);
    setEnCours(false);
  }

  const cle = () => crypto.randomUUID();
  const libelle = libelleTypeDevis(type).toLowerCase();

  return (
    <div className="kaya-sale grid max-w-5xl gap-6 pb-28 lg:grid-cols-2">
      <section aria-label="Produits" className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
            <FileText aria-hidden="true" size={26} />
          </span>
          <div>
            <h1 className="text-xl font-bold">
              {initial ? "Modifier le brouillon" : `Nouveau ${libelle}`}
            </h1>
            <p className="text-muted text-sm">Les prix sont ceux d&apos;aujourd&apos;hui</p>
          </div>
        </div>
        <div role="group" aria-label="Type de document" className="flex gap-2">
          {(["devis", "proforma"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`min-h-11 flex-1 rounded-full px-4 text-sm font-bold ${type === t ? "bg-orange-500 text-white" : "border-border border bg-white"}`}
            >
              {libelleTypeDevis(t)}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          placeholder="Chercher un produit ou une marque"
          aria-label="Chercher un produit ou une marque"
          className={champ}
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
            {q ? "Aucun produit ne correspond." : "Aucun produit à proposer. Ajoutez d'abord des produits."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {produits.map((p) => (
              <li key={p.id} className="border-border flex flex-col gap-2 rounded-2xl border bg-white p-3 shadow-sm">
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
                        aria-label={`Ajouter ${u.nom} de ${p.nom}`}
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
        )}
      </section>

      <section aria-label="Contenu du devis" className="flex flex-col gap-4">
        <h2
          className="rounded-xl px-4 py-3 text-lg font-bold text-white"
          style={{ background: "linear-gradient(110deg,#ff8b1a,#f26a0f)" }}
        >
          Articles ({lignes.length})
        </h2>
        {lignesPerdues > 0 && (
          <p role="status" className="bg-brand-soft rounded-lg p-2 text-sm">
            {lignesPerdues === 1 ? "Un article n'est plus en vente" : `${lignesPerdues} articles ne sont plus en vente`} :
            {lignesPerdues === 1 ? " il a été retiré" : " ils ont été retirés"} de ce brouillon.
          </p>
        )}
        {lignes.length === 0 ? (
          <p className="text-muted">Touchez un produit pour l&apos;ajouter.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lignes.map((l) => (
              <LigneDuPanier
                key={l.cle}
                ligne={l}
                onQuantite={(v) => setLignes((x) => changerQuantite(x, l.cle, v))}
                onUnite={(id) => setLignes((x) => changerUnite(x, l.cle, id))}
                onRetirer={() => setLignes((x) => retirerDuPanier(x, l.cle))}
              />
            ))}
          </ul>
        )}

        {lignes.length > 0 && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="remise-devis" className="text-sm font-medium">Remise (FCFA)</label>
              <input
                id="remise-devis"
                inputMode="numeric"
                value={remiseTexte}
                onChange={(e) => setRemiseTexte(e.target.value)}
                placeholder="0"
                className={`${champ} w-40`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Client (facultatif)</span>
              <SelecteurClient client={client} onChoisir={setClient} obligatoire={false} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="validite" className="text-sm font-medium">Valable jusqu&apos;au</label>
              <input
                id="validite"
                type="date"
                min={aujourdhui}
                value={valideJusqu}
                onChange={(e) => setValideJusqu(e.target.value)}
                className={`${champ} w-48`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="conditions" className="text-sm font-medium">
                Conditions (facultatif)
              </label>
              <textarea
                id="conditions"
                value={conditions}
                maxLength={500}
                rows={3}
                placeholder="Ex. : 50 % à la commande, solde à la livraison."
                onChange={(e) => setConditions(e.target.value)}
                className={`${champ} py-2`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="note-devis" className="text-sm font-medium">
                Note pour le client (facultatif)
              </label>
              <textarea
                id="note-devis"
                value={note}
                maxLength={300}
                rows={2}
                placeholder="Ex. : livraison possible mardi."
                onChange={(e) => setNote(e.target.value)}
                className={`${champ} py-2`}
              />
            </div>
          </>
        )}
      </section>

      <div className="border-border bg-background fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-10 border-t p-3 md:bottom-0 md:left-56">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          {(erreur ?? probleme) && lignes.length > 0 && (
            <p role="alert" className="text-danger text-sm">{erreur ?? probleme}</p>
          )}
          {confirmer && (
            <p role="alert" className="bg-brand-soft rounded-lg p-2 text-sm">
              Une fois envoyé, ce {libelle} reçoit son numéro et ne peut plus être modifié.
              Pour le corriger, il faudra le dupliquer. Confirmer l&apos;envoi ?
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-muted text-sm">
                Total{totaux.remise > 0 && ` (remise ${formatFcfa(totaux.remise)})`}
              </p>
              <p className="text-2xl font-bold">{formatFcfa(totaux.total)}</p>
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              {!confirmer ? (
                <>
                  <button
                    type="button"
                    onClick={() => enregistrer(false)}
                    disabled={!peutEnregistrer}
                    className="border-border min-h-12 rounded-lg border bg-white px-4 font-bold disabled:opacity-50"
                  >
                    {enCours ? "Enregistrement…" : "Enregistrer le brouillon"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmer(true)}
                    disabled={!peutEnregistrer}
                    className="bg-brand-strong min-h-12 rounded-lg px-4 font-bold text-white disabled:opacity-50"
                  >
                    Envoyer
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmer(false)}
                    className="border-border min-h-12 rounded-lg border bg-white px-4 font-bold"
                  >
                    Revenir
                  </button>
                  <button
                    type="button"
                    onClick={() => enregistrer(true)}
                    disabled={!peutEnregistrer}
                    className="bg-brand-strong min-h-12 rounded-lg px-4 font-bold text-white disabled:opacity-50"
                  >
                    {enCours ? "Envoi…" : "Oui, envoyer"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
