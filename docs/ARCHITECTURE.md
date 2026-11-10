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
| `calculer_caisse` / `cloturer_caisse` / `valider_cloture` | tous / tous / proprio | espèces attendues, écart, alerte, validation                                                                   |

## Sécurité

RLS activée sur toutes les tables ; fonctions fermées à `anon` et ouvertes au rôle `authenticated` seulement quand voulu. Voir `tests/db/rls.test.ts`.
