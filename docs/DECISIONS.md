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

## Étape 4 : produits et stock

- **Migrations non encore déployées** : j'ai donc modifié la migration 3 (le reçu garde le nom affiché avec la marque) au lieu d'en ajouter une. **À partir du premier déploiement, plus aucune migration existante ne sera modifiée.**
- **Multi-marque** : une marque est une table (`marques`) ; chaque marque d'un même article est un **produit distinct** (« Ciment CPJ 42,5 · Dangote » et « … · CIMAF »), avec son stock, ses prix et ses alertes. Raison : le stock et le prix diffèrent réellement d'une marque à l'autre, et le vendeur choisit une marque précise. Le nom affiché (`nom_affiche`) et la recherche (`nom_recherche`, sans accents, marque comprise) sont tenus à jour par déclencheur, y compris quand on renomme une marque. Deux produits ne peuvent pas avoir le même nom et la même marque.
- **Multi-conditionnement** : un produit a autant d'unités de vente que nécessaire, chacune avec son facteur vers l'unité de base (ciment gris : sac de 50 kg ; ciment blanc ou colle : sac de 25 kg, de 5 kg ; peinture : pot, seau de 4 pots). Le stock reste compté en unité de base, ce qui évite les erreurs d'arrondi (1 kg sur 50 kg = 0,02 sac). Le formulaire propose les conditionnements courants selon l'unité de base (`lib/stock/unites.ts`).
- **« Même produit, autre marque »** : copie les unités, l'unité de base et le prix d'achat d'un produit pour en créer un autre sans tout ressaisir (la photo, le stock et la marque ne sont pas copiés).
- **Limite assumée** : un conditionnement non divisible (un sac de 5 kg qu'on ne peut pas ouvrir) partage quand même le stock en kg avec les autres conditionnements du même produit. Si un client a besoin de stocks séparés par conditionnement, on créera un produit distinct.
- **Fiche produit atomique** (`enregistrer_produit`) : produit, prix d'achat et unités dans une seule transaction. Une unité retirée est archivée (les ventes y font référence). L'unité de base ne peut plus changer dès qu'il existe un mouvement de stock.
- **Liste paginée par curseur** (`lister_produits`) : 30 par page, stock de la boutique inclus, jamais de prix d'achat. Recherche sans accents ni casse, filtres catégorie, marque et stock bas.
- **Photos** : voir `docs/R2.md`. Compression dans le navigateur, envoi par URL signée de 5 minutes, contrôle du fichier après envoi.
- **Prix d'achat et marge** : visibles du propriétaire seulement (table séparée, RLS).
- **Non fait ici** : e2e du parcours photo (étape 12) ; la compression réelle dans le navigateur (canvas) n'est pas testable en Node, seule sa logique l'est (algorithme de qualité, dimensions, empreinte).

## Étape 5 : vente

- **Le serveur recalcule tout** : le navigateur n'envoie que des identifiants, des quantités, des modes de paiement et des montants de paiement. Prix, remises, total, numéro de reçu et stock sont calculés par `creer_vente`. L'aperçu du panier (`lib/ventes/panier.ts`) est un confort d'affichage : son arrondi est **vérifié contre PostgreSQL** (`tests/db/coherence.test.ts`, 135 combinaisons, y compris les .5).
- **Arithmétique exacte** : prix d'une ligne = quantité en millièmes x prix, en entiers (BigInt), arrondi au FCFA le plus proche comme `round()` en base. Aucun flottant dans les montants.
- **Idempotence liée au contenu** : la clé de la vente est tirée au sort une fois par contenu de panier. Un double clic ou un nouvel essai après coupure réutilise la même clé (jamais de doublon) ; si le vendeur modifie le panier entre deux essais, une nouvelle clé est créée, pour qu'une vente déjà enregistrée ne remplace pas silencieusement le nouveau contenu.
- **Paiements** : sans crédit, le dernier mode prend le reste ; avec crédit, ce qui n'est pas payé devient la dette du client (client obligatoire). Paiement mixte = plusieurs lignes. Le propriétaire seul peut dépasser le plafond de crédit.
- **Remise** : le vendeur voit son seuil et un message avant de valider ; la base applique la même règle (le seuil affiché n'est qu'une aide).
- **Marques** : chaque marque est un produit distinct dans la recherche (« Ciment CPJ 42,5 · Dangote » / « · CIMAF »), avec une pastille par unité (« + sac de 50 kg · 5 500 FCFA »). Un tap = une ligne ; un second tap sur la même unité = quantité + 1. La marque figure sur le reçu.
- **Écran de succès = reçu relu en base** (`/vente/recu/[id]`), pas une copie de l'écran : le vendeur voit exactement ce qui a été enregistré, et peut le rouvrir.
- **Partage WhatsApp** : lien `wa.me` vers le numéro du client depuis le téléphone du vendeur (aucun appel à Zernio). Le message résume le reçu, sans marge ni prix d'achat. Le lien vers la page publique du reçu et le PDF viennent à l'étape 6 : je n'ai pas mis de lien qui mènerait à une page inexistante.
- **Impression** : bouton `window.print()` affiché seulement si le plan autorise l'impression (Pro, Business), avec un style qui n'imprime que le reçu. Ticket 58 mm, A4 et RawBT : étape 13.
- **Client rapide** : le vendeur crée un client (nom, téléphone facultatif) sans quitter la vente ; il ne fixe jamais de plafond de crédit (la RLS l'interdit).
- **Limites connues** : le panier n'est pas conservé si la page est rechargée (mode hors ligne et brouillons : étape 11). La rapidité « 3 articles en moins de 10 secondes » et le parcours complet seront mesurés par les tests de bout en bout (étape 12). La concurrence réelle (deux vendeurs, dernier article) reste testée en séquence ici.
- **Piège corrigé** : un test de caisse comptait la journée en UTC alors que la base la compte en heure de Douala ; il échouait entre 23 h et minuit UTC. Les tests utilisent désormais le fuseau de Douala.
