# Kaya

Gestion de stock, ventes, crédits et caisse pour quincailleries camerounaises. Mobile-first, FCFA, français.

## Installation (moins de 10 minutes)

```bash
npm install
cp .env.example .env.local   # renseigner les clés Supabase (étape 2)
npm run dev                  # http://localhost:3000
```

## Commandes

`npm run lint` · `npm run typecheck` · `npm test` (inclut les tests SQL) · `npm run test:coverage` · `npm run build`

Base de données : `supabase start` puis `npm run demo:reset` (migrations + données de démonstration). Comptes : `proprietaire@kaya.demo` et `vendeur@kaya.demo`, mot de passe `Demo1234!`.

Voir `docs/DECISIONS.md` et `docs/ARCHITECTURE.md`.
