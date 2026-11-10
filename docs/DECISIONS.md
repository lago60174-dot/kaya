# Décisions techniques

- **Stack** : Next.js (App Router), TypeScript strict, Tailwind, Supabase, Vitest, Playwright, comme recommandé.
- **Polices système** : pas de police web. Pages plus légères sur Android d'entrée de gamme et connexion lente.
- **Couleurs** : orange `#F97316` pour les accents, `#C2410C` pour les boutons (texte blanc, contraste AA). Fond `#FFFBF5`, texte `#1F2937`.
- **Versions figées** : aucune version avec `^` dans package.json. `@types/node` en 22 pour suivre Node 22 et rester compatible avec Vitest.
- **Argent** : entiers FCFA uniquement (`lib/format.ts` refuse les décimales). Quantités arrondies à 3 décimales.
- **shadcn/ui** : les composants seront ajoutés au fil des étapes (utilitaire `cn` déjà en place), pour ne livrer que ce qui sert.
- **Mode sombre** : non prévu, thème clair lisible en plein soleil.

## Étape 2 : base de données

- **Prix d'achat dans `produit_couts`, coût figé dans `vente_lignes_couts`** : la RLS filtre des lignes, pas des colonnes. Mettre ces données dans des tables lisibles par le propriétaire seul garantit qu'un vendeur ne les voit jamais, même en interrogeant l'API directement.
- **`supabase/` au lieu de `db/`** : le dossier standard de la CLI Supabase contient migrations et `seed.sql`.
- **Écritures sensibles uniquement par fonctions SQL** (security definer) : ventes, annulations, remboursements, mouvements de stock, clôtures. Aucun droit d'écriture direct pour les utilisateurs sur ces tables. Les fonctions vérifient rôle et boutique elles-mêmes.
- **Paiements : un seul montant peut être omis**, il prend le reste à payer. Ce qui n'est pas payé devient un crédit (client obligatoire).
- **Remise** : le vendeur est limité au seuil ; le propriétaire n'a pas de plafond. « Forcer » (plafond de crédit) est réservé au propriétaire.
- **Annulation** : l'avoir rembourse en espèces tous les paiements espèces de la vente (y compris les remboursements de crédit liés). La caisse du jour le déduit.
- **Immutabilité** : triggers sur mouvements, paiements, avoirs, lignes de vente et journal (aucune modification ni suppression, même pour le service_role). Une vente ne change qu'une fois (valide vers annulée). Pas de suppression physique des données métier.
- **Plafond de crédit par défaut** : 100 000 FCFA (modifiable dans les paramètres).
- **Tests SQL avec PGlite** (PostgreSQL réel en mémoire) : un petit module imite `auth.uid()` et les rôles Supabase. Aucun serveur à installer pour lancer la CI.
- **Seed** : seule exception à l'immutabilité (il étale les dates des ventes sur 7 jours, avec `session_replication_role = replica`). Ne jamais l'exécuter en production.
- **Types TypeScript** : `npm run types` les génère depuis une base Supabase locale (nécessite la CLI Supabase et Docker).

### Limites connues de l'étape 2

- La concurrence est protégée par des verrous de lignes (`FOR UPDATE`, compteur verrouillé) mais PGlite n'a qu'une connexion : le test « deux ventes du dernier article » est séquentiel. À rejouer en parallèle sur une vraie base Supabase à l'étape 12.
- Un seul compte propriétaire par organisation pour l'instant, et un utilisateur n'appartient qu'à une organisation.
