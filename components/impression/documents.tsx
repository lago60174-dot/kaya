"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DocumentRecu } from "@/lib/print/document";
import "./impression.css";

interface Props {
  doc: DocumentRecu;
  /** Logo de la boutique (adresse relative servie par l'application). */
  logoUrl?: string | null;
}

/** Signature, cachet et nom du signataire. Rien ne s'affiche si la boutique n'a rien renseigné. */
function MarquesSignature({ doc, classe }: { doc: DocumentRecu; classe: string }) {
  const s = doc.signature;
  if (!s) return null;
  return (
    <div className={classe}>
      <div className="s-images">
        {s.signatureUrl && (
          // PNG déjà réduit à l'envoi (320 px maximum).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.signatureUrl} alt="" />
        )}
        {s.cachetUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.cachetUrl} alt="" />
        )}
      </div>
      {s.signataire && <div className="s-nom">{s.signataire}</div>}
    </div>
  );
}

/** Ticket 58 mm pour la boîte d'impression du navigateur. Caché à l'écran. */
export function TicketImprimable({ doc, logoUrl }: Props) {
  return (
    <section className="recu-ticket" aria-hidden="true">
      <header className="t-centre">
        {logoUrl && (
          // Logo déjà réduit à l'envoi (PNG, 300 px maximum) : le composant Image n'apporterait rien ici.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="t-logo" src={logoUrl} alt="" />
        )}
        <div className="t-nom">{doc.boutique.nom}</div>
        {doc.boutique.adresse && <div>{doc.boutique.adresse}</div>}
        {doc.boutique.telephone && <div>Tél. {doc.boutique.telephone}</div>}
        {doc.identite.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </header>
      <hr />
      <div className="gras">{doc.titre}</div>
      <div>{doc.date}</div>
      {doc.client && <div>Client : {doc.client}</div>}
      {doc.serviPar && <div>Servi par : {doc.serviPar}</div>}
      {doc.precision && <div>{doc.precision}</div>}
      {doc.annule && <div className="t-annule">ANNULÉ</div>}
      <hr />
      {doc.lignes.map((l, i) => (
        <div key={i}>
          <div className="t-ligne gras">
            <span>{l.designation}</span>
            <span>{l.montant}</span>
          </div>
          {l.detail && <div className="t-detail">{l.detail}</div>}
        </div>
      ))}
      <hr />
      {doc.totaux.map((t, i) => (
        <div key={i} className={`t-ligne niveau-${t.niveau}`}>
          <span>{t.libelle}</span>
          <span>{t.montant}</span>
        </div>
      ))}
      <MarquesSignature doc={doc} classe="t-signature" />
      {doc.mentionLegale && <p className="t-mention">{doc.mentionLegale}</p>}
      {doc.remerciement && <p className="t-centre">{doc.remerciement}</p>}
    </section>
  );
}

/** Facture A4 (tableau, totaux, pied de page). Cachée à l'écran. */
export function FactureA4({ doc, logoUrl }: Props) {
  return (
    <section className="recu-a4" aria-hidden="true">
      <header className="a-entete">
        <div>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="a-logo" src={logoUrl} alt="" />
          )}
          <div className="a-boutique">{doc.boutique.nom}</div>
          {doc.boutique.adresse && <div>{doc.boutique.adresse}</div>}
          {doc.boutique.telephone && <div>Tél. {doc.boutique.telephone}</div>}
          {doc.identite.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        <div className="a-titre">
          <h1>{doc.type === "vente" ? "Facture" : "Reçu de paiement"}</h1>
          <div>
            <strong>{doc.numero}</strong>
          </div>
          <div>{doc.date}</div>
          {doc.annule && <div className="a-annule">ANNULÉ</div>}
        </div>
      </header>
      {(doc.client || doc.precision) && (
        <div className="a-client">
          {doc.client && (
            <div>
              Client : <strong>{doc.client}</strong>
            </div>
          )}
          {doc.precision && <div>{doc.precision}</div>}
        </div>
      )}
      {doc.serviPar && <div className="a-client">Servi par : {doc.serviPar}</div>}
      <table>
        <thead>
          <tr>
            <th>{doc.colonnes.designation}</th>
            {doc.colonnes.quantite ? (
              <>
                <th className="a-droite">Quantité</th>
                <th className="a-droite">Prix unitaire</th>
              </>
            ) : (
              <th>Situation</th>
            )}
            <th className="a-droite">Montant</th>
          </tr>
        </thead>
        <tbody>
          {doc.lignes.map((l, i) => (
            <tr key={i}>
              <td>{l.designation}</td>
              {doc.colonnes.quantite ? (
                <>
                  <td className="a-droite">{l.quantite}</td>
                  <td className="a-droite">{l.prixUnitaire}</td>
                </>
              ) : (
                <td>{l.detail}</td>
              )}
              <td className="a-droite">{l.montant}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="a-totaux">
        {doc.totaux.map((t, i) => (
          <div key={i} className={`niveau-${t.niveau}`}>
            <span>{t.libelle}</span>
            <span>{t.montant}</span>
          </div>
        ))}
      </div>
      <MarquesSignature doc={doc} classe="a-signature" />
      <footer className="a-pied">
        {doc.mentionLegale && <p>{doc.mentionLegale}</p>}
        {doc.remerciement && <p>{doc.remerciement}</p>}
      </footer>
    </section>
  );
}

const surLeClient = () => () => {};
const vrai = () => true;
const faux = () => false;

/**
 * Les deux formats d'un reçu, prêts pour `window.print()`. À n'afficher que si le plan autorise l'impression.
 * Placés directement sous <body> (portail) : à l'impression on masque alors tout le reste de la page
 * (display: none). Sans cela, la mise en page cachée de l'application ajoutait des pages blanches.
 */
export function DocumentsImprimables({ doc, logoUrl }: Props) {
  const monte = useSyncExternalStore(surLeClient, vrai, faux);
  if (!monte) return null;
  return createPortal(
    <>
      <TicketImprimable doc={doc} logoUrl={logoUrl} />
      <FactureA4 doc={doc} logoUrl={logoUrl} />
    </>,
    document.body,
  );
}
