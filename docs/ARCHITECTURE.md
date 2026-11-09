# Architecture

- `app/` routes et pages · `components/` composants partagés
- `features/<domaine>/` stock, ventes, clients, caisse, patron
- `lib/` utilitaires (format, env, supabase, impression) · `server/` actions et services
- `db/` seed · `supabase/migrations/` migrations SQL versionnées
- Règle : la logique métier vit dans des fonctions pures testées, hors de React.
  Le schéma de base et les flux seront documentés à l'étape 2.
