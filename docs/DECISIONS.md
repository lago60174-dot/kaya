# Décisions techniques

- **Stack** : Next.js (App Router), TypeScript strict, Tailwind, Supabase, Vitest, Playwright, comme recommandé.
- **Polices système** : pas de police web. Pages plus légères sur Android d'entrée de gamme et connexion lente.
- **Couleurs** : orange `#F97316` pour les accents, `#C2410C` pour les boutons (texte blanc, contraste AA). Fond `#FFFBF5`, texte `#1F2937`.
- **Versions figées** : aucune version avec `^` dans package.json. `@types/node` en 22 pour suivre Node 22 et rester compatible avec Vitest.
- **Argent** : entiers FCFA uniquement (`lib/format.ts` refuse les décimales). Quantités arrondies à 3 décimales.
- **shadcn/ui** : les composants seront ajoutés au fil des étapes (utilitaire `cn` déjà en place), pour ne livrer que ce qui sert.
- **Mode sombre** : non prévu, thème clair lisible en plein soleil.
