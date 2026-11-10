# Décisions techniques

- **Stack** : Next.js 16 (App Router), TypeScript strict, Tailwind, Supabase, Vitest, Playwright, déployé sur Cloudflare Workers avec OpenNext (`@opennextjs/cloudflare`, compatible Next >= 16.4.5). Le build Workers est vérifié (`npm run build:cf`).
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

## Mise à niveau vers la version 2 du prompt (plans, affiliation, Cloudflare)

- **Migration 5 (`plateforme`)** : plans, abonnements, factures d'abonnement, journal des webhooks, envois WhatsApp, paramètres de plateforme, affiliés, parrainages, commissions, versements, journal d'audit. Les tables de la phase B (devis, fournisseurs) seront ajoutées à leurs étapes.
- **Administrateur et affilié hors des organisations** : ce ne sont pas des lignes de `membres` (qui exige une organisation). Tables `administrateurs_plateforme` et `affilies`, avec les fonctions `app_est_admin()` et `app_affilie_id()`. Un affilié ne voit que ses parrainages (l'identifiant de l'organisation, jamais ses données) ; l'administrateur ne lit aucune donnée de vente.
- **Plans en base** : `peut_utiliser(organisation, fonction)` et `limite_plan(organisation, cle)` côté SQL, `peutUtiliser` et `limite` côté TypeScript (`lib/plans.ts`), même règle (limite absente = 0, null = illimité). Un utilisateur ne peut interroger que sa propre organisation. Un plan masqué n'est lisible ni par un visiteur ni par une autre organisation.
- **Limites imposées par triggers** (vendeurs actifs, boutiques) : même la clé service_role ne les contourne pas. Messages en français, sans incitation à changer de plan.
- **Lecture seule d'un compte suspendu ou annulé** : `verifier_ecriture` dans chaque fonction d'écriture, et politiques RESTRICTIVE sur les écritures directes. La lecture reste possible, rien n'est supprimé.
- **Journal de base ou complet** : politique RLS selon le plan (de base : ventes, annulations, remises, clôtures).
- **`organisations.plan_code`** est le plan en vigueur ; `abonnements` porte le cycle de facturation. Ils seront synchronisés par les fonctions d'abonnement (étape 18).
- **Images** : `photo_url` remplacé par `image_cle` et `vignette_cle` (clés R2).
- **Seed** : la démo est en plan Business pour montrer toutes les fonctions ; comptes `admin@kaya.demo` et `affilie@kaya.demo` (code DEMO20). Filleuls, commissions et factures de démonstration arrivent aux étapes 18 à 20.

## Étape 3 : authentification, rôles, plans

- **Inscription et comptes créés par le serveur** : `auth.admin.createUser` (email confirmé d'office) puis `creer_organisation`. L'inscription directe par l'API Supabase est fermée (`enable_signup = false`) pour ne pas contourner Turnstile. Limite connue : l'email n'est pas vérifié au MVP (aucun envoi d'email prévu), à reconsidérer.
- **Mot de passe provisoire des vendeurs** : généré côté serveur (10 caractères lisibles), affiché une seule fois, marqueur `doit_changer_mot_de_passe` dans `app_metadata` (non modifiable par l'utilisateur). Toute page protégée renvoie vers `/mot-de-passe` tant qu'il n'est pas changé. Un vendeur désactivé est aussi bloqué côté Supabase Auth.
- **Défense en profondeur** : proxy (redirection des visiteurs), garde dans les pages et les actions (`exigerRole`, `decisionGarde` testée), RLS et triggers. **Risque** : OpenNext classe le proxy Node.js comme expérimental sur Cloudflare. Le proxy ne protège rien à lui seul ; s'il pose problème en production, le retirer ne crée aucune faille (mais la session ne sera plus rafraîchie automatiquement : prévoir alors un rafraîchissement côté client).
- **Cache Components (Next 16)** : la session est lue derrière un `<Suspense>`, comme le recommande le guide officiel. Les pages gardent une coque statique.
- **Parrainage** : `/a/CODE` pose un cookie de 30 jours (premier contact, jamais écrasé) ; le code saisi à l'inscription l'emporte. Auto-parrainage refusé (même compte, téléphone ou email) et signalé. Un code inconnu ou un affilié non validé n'empêche pas l'inscription.
- **Turnstile** : vérification serveur, refusée en production si la clé secrète manque (échec fermé).
- **Déconnexion automatique** après 2 h d'inactivité (`lib/auth/inactivite.ts`).
- **Limites connues** : le chargement du profil (`server/auth/profil.ts`) et les actions Supabase ne sont pas couverts par des tests automatiques ici (pas de Supabase local) ; ils le seront par les tests de bout en bout de l'étape 12. L'espace administrateur et l'espace affilié (pages) arrivent aux étapes 19 et 20 : les rôles et les gardes existent déjà.
