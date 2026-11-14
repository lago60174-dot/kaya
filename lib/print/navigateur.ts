import type { Environnement, FormatImpression } from "./index";

const ID_STYLE = "kaya-page-impression";
const PAGE: Record<FormatImpression, string> = {
  // Pas de taille pour le ticket : Chrome ne gère pas « 58mm auto ». Le papier vient de l'imprimante (rouleau 58 mm),
  // et la largeur du ticket est fixée en CSS (58 mm).
  ticket: "@page { margin: 0; }",
  a4: "@page { size: A4; margin: 14mm; }",
};

/**
 * Boîte d'impression du navigateur au bon format. `@page` ne peut pas dépendre d'un attribut :
 * on pose donc une feuille de style le temps de l'impression, et `data-impression` choisit le document à sortir.
 */
export function imprimerPageNavigateur(
  format: FormatImpression,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof window.print !== "function") {
      reject(new Error("Impression indisponible."));
      return;
    }
    const style = document.createElement("style");
    style.id = ID_STYLE;
    style.textContent = PAGE[format];
    document.head.append(style);
    document.body.dataset.impression = format;
    let nettoye = false;
    const nettoyer = () => {
      if (nettoye) return;
      nettoye = true;
      style.remove();
      delete document.body.dataset.impression;
      window.removeEventListener("afterprint", nettoyer);
    };
    window.addEventListener("afterprint", nettoyer);
    // Sur certains téléphones, `afterprint` n'arrive pas : on nettoie quand même.
    window.setTimeout(nettoyer, 120_000);
    try {
      window.print();
      resolve();
    } catch (e) {
      nettoyer();
      reject(e);
    }
  });
}

/** Environnement réel : Android et navigateur de l'utilisateur. */
export function environnementNavigateur(): Environnement {
  return {
    userAgent: navigator.userAgent,
    ouvrirLien: (lien) => {
      window.location.href = lien;
    },
    imprimerPage: imprimerPageNavigateur,
    ouvrirPdf: (url) => {
      // Même origine : pas de « noopener » (il ferait renvoyer null et empêcherait de savoir si la fenêtre est bloquée).
      if (!window.open(url, "_blank")) throw new Error("Fenêtre bloquée.");
    },
  };
}
