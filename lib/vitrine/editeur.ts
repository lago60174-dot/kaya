/**
 * Identité de l'éditeur, affichée dans les mentions légales.
 * Une ligne laissée à null n'est pas affichée : on n'écrit jamais une information qu'on n'a pas.
 * À compléter avant le lancement public, puis à faire relire par un juriste (section 14 du cahier des charges).
 */
export const EDITEUR: {
  nom: string;
  statut: string;
  ville: string;
  adresse: string | null;
  formeJuridique: string | null;
  numeroRccm: string | null;
  numeroContribuable: string | null;
  email: string | null;
} = {
  nom: "Marc-well",
  statut: "entrepreneur",
  ville: "Yaoundé, Cameroun",
  adresse: null,
  formeJuridique: null,
  numeroRccm: null,
  numeroContribuable: null,
  email: null,
};

/** Date de la dernière relecture des textes légaux. */
export const MISE_A_JOUR_LEGALE = "13 novembre 2026";
