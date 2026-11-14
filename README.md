# Kaya

Gestion de stock, ventes, crédits et caisse pour quincailleries camerounaises. Mobile-first, FCFA, français.

## Installation (moins de 10 minutes)

```bash
npm install
cp .env.example .env.local   # renseigner les clés Supabase (étape 2)
npm run dev                  # http://localhost:3000
npm run deploy               # déploiement Vercel en production (CLI `vercel`)
```

## Déploiement Vercel (quelques secondes)

1. Une seule fois : `npx vercel login` puis `npx vercel link` (ou importer le dépôt GitHub dans Vercel : chaque `git push` déploie tout seul, sans CI GitHub).
2. Ajouter les variables d'environnement (Production) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`. Voir `.env.example`.
3. `npm run deploy`. Les vérifications se lancent à la demande : `npm run lint`, `npm run typecheck`.

## Commandes

`npm run lint` · `npm run typecheck` · `npm run build`

Base de données : `supabase start` puis `npm run demo:reset` (migrations + données de démonstration). Comptes : `proprietaire@kaya.demo` et `vendeur@kaya.demo`, mot de passe `Demo1234!`.

Voir `docs/DECISIONS.md` et `docs/ARCHITECTURE.md`.
## Interface Kaya

La direction artistique orange et les règles responsive de l’espace de gestion sont décrites dans [`docs/UI-REDESIGN.md`](docs/UI-REDESIGN.md).
