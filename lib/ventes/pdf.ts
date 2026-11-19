import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import { documentDepuisVente, type DocumentRecu } from "@/lib/print/document";
import type { RecuAffichable } from "./recu";

const LARGEUR = 300;
const MARGE = 16;
const UTILE = LARGEUR - 2 * MARGE;

/** La police standard ne sait écrire que le latin d'Europe de l'Ouest : on remplace le reste au lieu de planter. */
export function nettoyerPourPdf(texte: string): string {
  return texte
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .replace(/\u202F/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** Coupe un texte en lignes qui tiennent dans `largeurMax` (un mot trop long est coupé). */
export function couper(
  texte: string,
  police: Pick<PDFFont, "widthOfTextAtSize">,
  taille: number,
  largeurMax: number,
): string[] {
  const lignes: string[] = [];
  let courante = "";
  const tient = (t: string) =>
    police.widthOfTextAtSize(t, taille) <= largeurMax;
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (tient(essai)) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    let reste = mot;
    while (!tient(reste) && reste.length > 1) {
      let n = reste.length - 1;
      while (n > 1 && !tient(reste.slice(0, n))) n--;
      lignes.push(reste.slice(0, n));
      reste = reste.slice(n);
    }
    courante = reste;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

type Alignement = "gauche" | "droite" | "centre";
interface Operation {
  y: number;
  texte?: string;
  taille?: number;
  gras?: boolean;
  alignement?: Alignement;
  couleur?: [number, number, number];
  trait?: boolean;
  image?: { objet: PDFImage; largeur: number; hauteur: number; x?: number };
}

const GRIS: [number, number, number] = [0.4, 0.4, 0.4];
const ROUGE: [number, number, number] = [0.72, 0.11, 0.11];

/** Image PNG ou JPEG de la boutique (logo, signature, cachet) (pdf-lib ne lit pas le WebP). */
export interface LogoPdf {
  octets: Uint8Array;
  format: "png" | "jpg";
}

const LOGO_MAX = { largeur: 150, hauteur: 56 };
const MARQUE_MAX = { largeur: 118, hauteur: 52 };

/** Images à poser sur le reçu. Une image illisible est ignorée : elle ne doit jamais empêcher le reçu. */
export interface ImagesPdf {
  logo?: LogoPdf | null;
  signature?: LogoPdf | null;
  cachet?: LogoPdf | null;
}

/** Reçu de vente en PDF. */
export function genererRecuPdf(
  recu: RecuAffichable,
  options: ImagesPdf = {},
): Promise<Uint8Array> {
  return genererDocumentPdf(documentDepuisVente(recu), {
    ...options,
    date: recu.date,
  });
}

/**
 * Document PDF d'une seule page, aussi haute que nécessaire : lisible sur un téléphone, partageable par WhatsApp.
 * Sert aux reçus de vente et de paiement. Un logo illisible est ignoré : il ne doit jamais empêcher le reçu.
 */
export async function genererDocumentPdf(
  recu: DocumentRecu,
  options: ImagesPdf & { date?: string } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const ops: Operation[] = [];
  let y = MARGE;

  const texte = (
    t: string,
    taille: number,
    o: {
      gras?: boolean;
      alignement?: Alignement;
      couleur?: [number, number, number];
    } = {},
  ) => {
    const police = o.gras ? gras : normal;
    for (const ligne of couper(nettoyerPourPdf(t), police, taille, UTILE)) {
      y += taille * 1.3;
      ops.push({ y, texte: ligne, taille, ...o });
    }
  };
  /** Texte à gauche (qui peut passer à la ligne) et montant à droite sur la première ligne. */
  const deuxColonnes = (
    gauche: string,
    droite: string,
    taille: number,
    o: { gras?: boolean; couleur?: [number, number, number] } = {},
  ) => {
    const police = o.gras ? gras : normal;
    const d = nettoyerPourPdf(droite);
    const largeurDroite = d ? police.widthOfTextAtSize(d, taille) + 8 : 0;
    const lignes = couper(
      nettoyerPourPdf(gauche),
      police,
      taille,
      UTILE - largeurDroite,
    );
    lignes.forEach((ligne, i) => {
      y += taille * 1.3;
      ops.push({ y, texte: ligne, taille, alignement: "gauche", ...o });
      if (i === 0 && d)
        ops.push({ y, texte: d, taille, alignement: "droite", ...o });
    });
  };
  const trait = () => {
    y += 6;
    ops.push({ y, trait: true });
    y += 4;
  };
  const espace = (n: number) => (y += n);

  if (options.logo) {
    try {
      const objet =
        options.logo.format === "png"
          ? await doc.embedPng(options.logo.octets)
          : await doc.embedJpg(options.logo.octets);
      const echelle = Math.min(
        1,
        LOGO_MAX.largeur / objet.width,
        LOGO_MAX.hauteur / objet.height,
      );
      const largeur = objet.width * echelle;
      const hauteur = objet.height * echelle;
      y += hauteur;
      ops.push({ y, image: { objet, largeur, hauteur } });
      y += 4;
    } catch {
      // logo illisible : le reçu reste valable sans lui
    }
  }
  texte(recu.boutique.nom, 14, { gras: true, alignement: "centre" });
  if (recu.boutique.adresse)
    texte(recu.boutique.adresse, 8.5, { alignement: "centre", couleur: GRIS });
  if (recu.boutique.telephone)
    texte(`Tél. ${recu.boutique.telephone}`, 8.5, {
      alignement: "centre",
      couleur: GRIS,
    });
  for (const ligne of recu.identite)
    texte(ligne, 8, { alignement: "centre", couleur: GRIS });
  trait();
  texte(recu.titre, 10.5, { gras: true });
  texte(recu.date, 9, { couleur: GRIS });
  if (recu.client) texte(`Client : ${recu.client}`, 9);
  if (recu.serviPar) texte(`Servi par : ${recu.serviPar}`, 9, { couleur: GRIS });
  if (recu.precision) texte(recu.precision, 9);
  if (recu.annule) {
    espace(4);
    texte("ANNULÉ", 16, { gras: true, alignement: "centre", couleur: ROUGE });
  }
  trait();

  for (const l of recu.lignes) {
    deuxColonnes(l.designation, l.montant, 9.5);
    if (l.detail) texte(l.detail, 8, { couleur: GRIS });
    espace(3);
  }
  trait();
  for (const t of recu.totaux) {
    if (t.niveau === "majeur")
      deuxColonnes(t.libelle, t.montant, 12.5, { gras: true });
    else if (t.niveau === "fort")
      deuxColonnes(t.libelle, t.montant, 10.5, { gras: true });
    else if (t.niveau === "discret")
      deuxColonnes(t.libelle, t.montant, 9, { couleur: GRIS });
    else deuxColonnes(t.libelle, t.montant, 9.5);
  }
  for (const n of recu.notes ?? []) {
    espace(5);
    texte(n, 8.5);
  }
  if (recu.signature) {
    const integrer = async (img: LogoPdf | null | undefined) => {
      if (!img) return null;
      try {
        const objet =
          img.format === "png"
            ? await doc.embedPng(img.octets)
            : await doc.embedJpg(img.octets);
        const echelle = Math.min(
          1,
          MARQUE_MAX.largeur / objet.width,
          MARQUE_MAX.hauteur / objet.height,
        );
        return { objet, largeur: objet.width * echelle, hauteur: objet.height * echelle };
      } catch {
        return null;
      }
    };
    const [sig, cachet] = await Promise.all([
      integrer(options.signature),
      integrer(options.cachet),
    ]);
    if (sig || cachet || recu.signature.signataire) {
      espace(10);
      texte("Signature et cachet", 7.5, { couleur: GRIS });
      const haut = Math.max(sig?.hauteur ?? 0, cachet?.hauteur ?? 0);
      if (haut > 0) {
        espace(2);
        y += haut;
        const colonne = UTILE / 2;
        if (sig)
          ops.push({
            y,
            image: { ...sig, x: MARGE + (colonne - sig.largeur) / 2 },
          });
        if (cachet)
          ops.push({
            y,
            image: { ...cachet, x: MARGE + colonne + (colonne - cachet.largeur) / 2 },
          });
        y += 2;
      }
      if (recu.signature.signataire)
        texte(recu.signature.signataire, 8.5, { gras: true, alignement: "centre" });
    }
  }
  if (recu.mentionLegale) {
    espace(8);
    texte(recu.mentionLegale, 7.5, { alignement: "centre", couleur: GRIS });
  }
  if (recu.remerciement) {
    espace(6);
    texte(recu.remerciement, 9, { alignement: "centre" });
  }

  const hauteur = Math.max(160, y + MARGE);
  const page = doc.addPage([LARGEUR, hauteur]);
  for (const op of ops) {
    const yPdf = hauteur - op.y;
    if (op.image) {
      page.drawImage(op.image.objet, {
        x: op.image.x ?? (LARGEUR - op.image.largeur) / 2,
        y: yPdf,
        width: op.image.largeur,
        height: op.image.hauteur,
      });
      continue;
    }
    if (op.trait) {
      page.drawLine({
        start: { x: MARGE, y: yPdf },
        end: { x: LARGEUR - MARGE, y: yPdf },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
        dashArray: [3, 2],
      });
      continue;
    }
    const police = op.gras ? gras : normal;
    const largeur = police.widthOfTextAtSize(op.texte!, op.taille!);
    const x =
      op.alignement === "droite"
        ? LARGEUR - MARGE - largeur
        : op.alignement === "centre"
          ? (LARGEUR - largeur) / 2
          : MARGE;
    const [r, g, b] = op.couleur ?? [0.1, 0.1, 0.1];
    page.drawText(op.texte!, {
      x,
      y: yPdf,
      size: op.taille!,
      font: police,
      color: rgb(r, g, b),
    });
  }
  doc.setTitle(recu.titre);
  doc.setProducer("Kaya");
  if (options.date) doc.setCreationDate(new Date(options.date));
  return doc.save();
}
