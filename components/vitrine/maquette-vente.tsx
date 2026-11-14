import { formatFcfa } from "@/lib/format";

// Exemple fictif : prix modifiables par chaque boutique. Le total est calculé ici, pas écrit à la main.
const LIGNES = [
  { nom: "Ciment CPJ 42,5", detail: "10 sacs de 50 kg × 5 500", total: 55000 },
  { nom: "Fer à béton 10 mm", detail: "20 barres × 4 800", total: 96000 },
  { nom: "Clous 3 pouces", detail: "2 kg × 1 200", total: 2400 },
];
const TOTAL = LIGNES.reduce((somme, l) => somme + l.total, 0);
const ESPECES = 100000;

const nombre = (n: number) => formatFcfa(n).replace(/\u00A0FCFA$/, "");

/** L'écran de vente de Kaya, en HTML : léger, net sur tous les écrans, et la vente s'y remplit toute seule. */
export function MaquetteVente() {
  return (
    <div
      className="telephone"
      role="img"
      aria-label="Exemple d'une vente dans Kaya : trois articles, un total de 153 400 FCFA payé en partie en espèces et en partie à crédit, puis le reçu R-2026-000123."
    >
      <div className="ecran" aria-hidden="true">
        <div className="appbar">
          <b>Vente</b>
          <span>Quincaillerie du Centre</span>
        </div>
        <div className="champ-demo">ciment</div>
        <ul className="panier">
          {LIGNES.map((l, i) => (
            <li key={l.nom} className={`demo-l${i + 1}`}>
              <span>
                <b>{l.nom}</b>
                <small>{l.detail}</small>
              </span>
              <b>{nombre(l.total)}</b>
            </li>
          ))}
        </ul>
        <div className="total demo-total">
          <span>Total</span>
          <b>{formatFcfa(TOTAL)}</b>
        </div>
        <div className="paiements demo-paiements">
          <span>Espèces {nombre(ESPECES)}</span>
          <span>Crédit {nombre(TOTAL - ESPECES)}</span>
        </div>
        <div className="valider demo-valider">Valider la vente</div>
        <div className="succes demo-succes">
          <b>Vente enregistrée</b>
          Reçu R-2026-000123, prêt à partir sur WhatsApp
        </div>
      </div>
    </div>
  );
}
