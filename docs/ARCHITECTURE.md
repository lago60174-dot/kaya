# Architecture

- `app/` routes et pages · `components/` composants partagés
- `features/<domaine>/` stock, ventes, clients, caisse, patron
- `lib/` utilitaires (format, env, supabase, impression) · `server/` actions et services
- `supabase/migrations/` schéma, règles, fonctions, RLS · `supabase/seed.sql` démo
- `tests/db/` tests SQL (ventes, caisse, RLS, seed) avec PostgreSQL en mémoire
- Règle : la logique métier vit dans des fonctions pures testées, hors de React.

## Base de données

Organisation (1) → boutiques → membres (proprietaire ou vendeur, boutiques autorisées).
Catalogue : categories, produits, produit_unites (facteur vers l'unité de base, prix de vente), produit_couts (prix d'achat, propriétaire seul).
Stock : `mouvements_stock` (registre, jamais modifié) → trigger → `stock_courant`.
Ventes : ventes → vente_lignes (+ vente_lignes_couts, propriétaire seul) → paiements → creances (crédit) → avoirs (annulation).
Caisse : depenses, clotures_caisse. Numérotation : compteurs_recus. Traçabilité : journal_activite (ajout seulement).

## Flux principaux (fonctions SQL atomiques)

| Fonction                                                  | Qui                   | Effet                                                                                                          |
| --------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `creer_organisation`                                      | utilisateur connecté  | crée organisation, boutique, paramètres, membre propriétaire                                                   |
| `creer_vente`                                             | proprio, vendeur      | recalcule prix, contrôle remise/stock/crédit, écrit lignes, paiements, créance, stock, numéro de reçu, journal |
| `annuler_vente`                                           | proprio               | avoir + retour en stock + créance annulée, motif obligatoire                                                   |
| `enregistrer_remboursement`                               | proprio, vendeur      | paiement partiel ou total d'un crédit, reçu `P-année-n`                                                        |
| `enregistrer_mouvement_stock`                             | proprio               | entrée, perte, inventaire, correction (unités de vente converties)                                             |
| `tableau_de_bord`                                         | proprio               | tout l'écran d'accueil en un appel (ventes, caisse, dettes, stock bas, vendeurs, top produits)                 |
| `lister_journal`                                          | proprio (RLS du plan) | journal paginé par curseur, filtres typés                                                                      |
| `enregistrer_depense`                                     | proprio, vendeur      | dépense idempotente (salaire : proprio seul), journal                                                          |
| `annuler_depense`                                         | proprio               | annule une dépense (motif obligatoire, impossible si la journée est clôturée), journal en alerte               |
| `definir_logo_boutique`                                   | proprio               | enregistre ou retire le logo de la boutique (clé de son organisation), journal                                 |
| `calculer_caisse` / `cloturer_caisse` / `valider_cloture` | tous / tous / proprio | espèces attendues, écart, alerte, validation                                                                   |

## Plans, abonnements, affiliation

`plans` (fonctionnalités et limites en JSON, `visible_public`) → `organisations.plan_code`. `abonnements` (essai, actif, en_retard, suspendu, annule) → `factures_abonnement` → `commissions` (une seule par facture) → `versements_affilies`. `parrainages` fixe l'affilié au premier contact. `evenements_paiement` journalise les webhooks (idempotence). Rôles de plateforme : `administrateurs_plateforme`, `affilies`.

## Authentification

Visiteur → `proxy.ts` (session, redirection) → page ou action → `exigerRole(zone)` (profil chargé via la RLS : rôle, organisation, plan) → fonctions SQL (rôle, plan, lecture seule) → RLS. Détail des zones : `lib/permissions.ts`.

## Produits, marques et stock

`categories`, `marques` → `produits` (nom, marque, unité de base, seuil, clés d'images) → `produit_unites` (conditionnements : facteur + prix) et `produit_couts` (prix d'achat, propriétaire seul). Un produit = un article d'une marque. Stock : `mouvements_stock` (registre) → `stock_courant` par boutique. Fonctions : `enregistrer_produit`, `archiver_produit`, `lister_produits`, `enregistrer_mouvement_stock`. Photos : R2 (`docs/R2.md`).

## Vente

Navigateur : panier et aperçu (`lib/ventes`) → `validerVenteAction` (rôle, validation Zod) → `creer_vente` (transaction : droits, plan, prix, remise, stock, crédit, lignes, paiements, créance, numéro, journal) → reçu relu par `lireRecu` → partage WhatsApp du vendeur. Un crédit crée une `creance` ; une annulation (propriétaire) crée un `avoir`.

## Reçus

Historique : `lister_recus` (curseur, filtres, RLS). Détail : `lireRecu` (vente, lignes, paiements, créance, avoir). Public : `recu_public(jeton)` → `/r/[jeton]` et `/r/[jeton]/pdf`. PDF : `lib/ventes/pdf.ts`. Annulation : `annuler_vente` (avoir, stock, créance). Partage : Web Share API (PDF) ou `wa.me`.

## Impression (section 10)

`DocumentRecu` (vente ou paiement) → quatre rendus : PDF (`lib/ventes/pdf.ts`), ticket ESC/POS 32 colonnes (`lib/print/ticket.ts` + `escpos.ts`, servi par les routes `/escpos` gardées par le plan), ticket 58 mm et facture A4 du navigateur (`components/impression`). L'écran appelle uniquement `imprimerRecu` : RawBT (Android) → `window.print()` → PDF.

## Clients et crédits

Un crédit crée une `creance` (par vente). `rembourser_client` : verrouille les créances du client, répartit le paiement sur les plus anciennes (une ligne `paiements` par vente, un seul `numero_recu`, une clé d'idempotence), met à jour les soldes, journalise. `lister_dettes` (qui me doit), `lister_clients` (curseur), fiche via la RLS. Rappels et reçus de paiement partagés par le WhatsApp du vendeur.

## Sécurité

RLS activée sur toutes les tables ; fonctions fermées à `anon` et ouvertes au rôle `authenticated` seulement quand voulu. Voir `tests/db/rls.test.ts`.

## Caisse et dépenses

`/caisse?date=AAAA-MM-JJ` (jour de Douala, jamais futur) : `calculer_caisse` (résumé) + `depenses` du jour + `clotures_caisse`. Saisie : `enregistrer_depense` (clé d'idempotence, refusée si la journée est clôturée). Correction : `annuler_depense` (propriétaire, motif). Clôture : `cloturer_caisse` (la base recalcule l'attendu, l'écart et l'alerte) puis `valider_cloture` par le propriétaire. Logique pure : `lib/caisse`.

## Tableau de bord et journal

`/patron` : `tableau_de_bord` + alertes récentes (`lister_journal`). `MiseAJourDirecte` (client) s'abonne à Realtime et appelle `router.refresh()` (regroupé, 800 ms) ; repli toutes les 30 s ; coupé quand l'onglet est caché. `/journal` : `lister_journal` (curseur validé), libellés dans `lib/journal`.
