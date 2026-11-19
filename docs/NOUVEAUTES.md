# Nouveautés (novembre 2026)

## Plusieurs boutiques par compte

- Migration à appliquer après la 22 : `supabase/migrations/20260101000023_plusieurs_boutiques.sql`.
- Réservé aux plans qui portent `multi_boutiques` (Business). Page **Boutiques** pour en ajouter ; sélecteur de boutique en haut de l'écran ; vue d'ensemble sur le tableau de bord ; choix des boutiques de chaque vendeur dans Paramètres → Vendeurs.
- Après une descente de plan, les boutiques en trop passent en lecture seule (rien n'est supprimé).
- **Transfert de stock** entre boutiques (page Stock → « Transférer du stock ») : migration `…025_transferts_stock.sql`. Propriétaire seulement, jamais de stock négatif, historique conservé.
- Détails et limites : `docs/DECISIONS.md`, section « Étape 16 ».

## 0. Fusion v12

Refonte de la vitrine, page Rapports, tableau de bord, conversion HEIC fusionnés. Migrations à appliquer dans l'ordre : 14, 15, puis `…016_rapports.sql` (ex-14 de la v12, renumérotée).

## 0 bis. Plans, tarifs, impression, sans essai

- Migration `…017_sans_essai.sql` à appliquer après la 16 : plus d'essai (statut `en_attente`), les 3 plans visibles.
- Page `/tarifs` détaillée ; fonctions non livrées (devis, fournisseurs, plusieurs boutiques, résumé WhatsApp) marquées « Bientôt disponible » (liste dans `lib/vitrine/comparatif.ts`).
- `/inscription?plan=pro` : la formule choisie s'applique au premier paiement.
- Impression : page blanche en trop corrigée (documents sous `<body>`), signataire sur le ticket, identité + signature + cachet sur les reçus de paiement de crédit.

## 1. Migration à appliquer
`supabase/migrations/20260101000014_recus_signature_notifications.sql` (Supabase → SQL Editor, ou `supabase db push`).
Elle ajoute : identité légale + signature + cachet des boutiques, notifications, préférences, abonnements push,
chiffres publics de la landing, et règle « pas d'essai, 3 jours de grâce ».
Pour exclure votre compte de test des chiffres de la landing :
`update organisations set hors_statistiques = true where id = '...';`

## 2. Variables Vercel (Settings → Environment Variables), puis redéployer
| Variable | Rôle |
|---|---|
| `RESEND_API_KEY`, `EMAIL_EXPEDITEUR` | Emails : bienvenue, confirmation, mot de passe oublié. Domaine à vérifier dans Resend (SPF/DKIM). Ex. `Kaya <bonjour@votre-domaine.com>` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notifications push. `npx web-push generate-vapid-keys`, sujet : `mailto:vous@exemple.com` |
| `NEXT_PUBLIC_APP_URL` | Adresse publique, ex. `https://kaya-a.vercel.app` (liens des emails) |

Sans ces variables rien ne casse : emails et push sont simplement désactivés.

## 3. Ce qui change
- Reçus : ville, email, RCCM, NIU, nom du vendeur, signature et cachet (Paramètres). Sur le PDF, l'impression et la page publique.
- Signature/cachet : photo sur feuille blanche, fond retiré automatiquement sur le téléphone, PNG < 40 Ko.
- Notifications : cloche + page /notifications, choix par alerte (dans l'app, téléphone, résumé WhatsApp à venir).
- Push : Android et PC directement ; iPhone seulement quand Kaya est ajoutée à l'écran d'accueil (règle d'Apple).
- Mot de passe oublié (/mot-de-passe-oublie) et confirmation d'adresse (non bloquante : la connexion reste immédiate).
- Landing : « Créer mon compte » (plus d'essai gratuit) ; section « en vrais chiffres » masquée tant qu'il y a moins d'une boutique réelle et 20 ventes.

## 4. Pas encore fait
- Résumé WhatsApp quotidien (Zernio), paiement Fapshi et relances, administration : phase B du cahier des charges.
- Limitation de débit sur « mot de passe oublié » : à activer dans Vercel Firewall (règle sur /mot-de-passe-oublie).

## Abonnements, Fapshi et rappels WhatsApp (section 11)

- Migration `20260101000015_abonnements.sql` à appliquer après la 14.
- Variables Vercel : `CRON_SECRET`, `FAPSHI_*`, `ZERNIO_*` (voir `.env.example`).
- Cron externe via cron-job.org (plus de cron Vercel) : créer un job
  - URL : `https://TON-URL/api/cron/abonnements`, méthode GET
  - Planification : une fois par jour, ex. 08:00 (fuseau Africa/Douala)
  - En-tête (Advanced > Headers) : `Authorization: Bearer <CRON_SECRET>`
  - Activer l'alerte d'échec dans cron-job.org ; un 401 = mauvais secret, 503 = `CRON_SECRET` absent sur Vercel.
- Webhook Fapshi : `https://VOTRE-URL/api/webhooks/fapshi`.
- Modèles WhatsApp : `docs/WHATSAPP_TEMPLATES.md`.
- ATTENTION comptes pilotes : une fois `CRON_SECRET` défini, les abonnements en `en_attente` passent en retard puis suspendues. Pour les garder :
  `update abonnements set statut='actif', prochaine_echeance = now() + interval '1 year' where statut='en_attente';`

## Fusion catalogue modèle (v5) + interface v22

- Ordre des migrations à appliquer : 14 recus_signature_notifications → 15 abonnements → 16 rapports → 17 sans_essai → 18 catalogue → 19 rapports_complement.
- Catalogue modèle : écran `/demarrage` (1re étape après l'inscription) et bouton « Catalogue modèle » dans Stock. Images à envoyer une fois dans R2 : `node catalogue/outils/televerser_r2.mjs` (voir `catalogue/README.md`).
- v22 : compléments rapports/caisse/paramètres (onglets Boutique, Vendeurs, Abonnement) repris.
- Notifications : conservé le système existant (table `notifications`, push, préférences, état lu). Le mécanisme `notifications_vues` de la v22 a été écarté (doublon).

## Plan obligatoire à l'inscription
- Le formulaire d'inscription affiche les plans publics ; en choisir un est obligatoire (paiement possible plus tard). Vérifié aussi côté serveur (plan inexistant ou non public refusé avant toute création de compte), puis enregistré via `choisir_plan`.

## Catalogue, duplication, classement hebdomadaire
- Catalogue modèle : la barre « Ajouter à ma boutique » était masquée par la navigation (mobile) et le menu latéral ; elle est maintenant au-dessus (classe `.kaya-barre-validation`).
- Stock : bouton « Dupliquer » sur la fiche produit. Copie catégorie, marque, photo, unités et prix (pas le stock ni le code-barres) ; on modifie puis on enregistre. Même nom + même marque reste interdit.
- Rapports : « Meilleurs vendeurs de la semaine » (lundi → dimanche, navigation semaine précédente/suivante) : classement des vendeurs et produits les plus vendus. Migration `20260101000020_classement_semaine.sql` (à appliquer après la 19).

## Panneau d'administration (/admin)
- Migration `20260101000021_administration.sql` (après la 20). Toutes les fonctions `admin_*` refusent un compte qui n'est pas administrateur de la plateforme.
- Créer l'administrateur (une fois, après avoir créé son compte normalement) :
  `insert into administrateurs_plateforme (utilisateur_id) select id from auth.users where email = 'TON_EMAIL';`
  À la connexion il arrive sur `/admin`. Un compte administrateur ne doit pas être aussi membre d'une boutique.
- Pages : Vue d'ensemble (boutiques, revenu mensuel estimé, encaissé 30 j, à encaisser, boutiques actives, à traiter), Boutiques (recherche, filtres statut/plan), Fiche boutique (infos, activité, parrain, factures, paiement manuel, changement de plan, suspendre / réactiver avec jours offerts / annuler, historique), Paiements (factures récentes, paiements Fapshi à revoir), Plans (prix et visibilité), Partenaires (accepter / refuser les demandes), Journal.
- Toute action est écrite dans `journal_audit`. Rien n'est supprimé.
- Pas encore fait : création automatique du compte partenaire à l'acceptation, versement des commissions, envoi manuel d'une relance WhatsApp.

## Résumé WhatsApp quotidien
- Migration `20260101000022_resume_whatsapp.sql` (après la 21).
- Le propriétaire l'active dans Paramètres > Boutique (désactivé par défaut ; plans Pro et Business ; numéro WhatsApp d'inscription).
- Contenu : ventes du jour, nombre de ventes, produit le plus vendu, produits en stock bas, crédits clients. Jamais de marge ni de prix d'achat.
- Un seul envoi par boutique et par jour (heure de Douala) ; échec retenté jusqu'à 3 fois aux exécutions suivantes.
- Nouveau job cron-job.org : GET `https://TON-URL/api/cron/resume`, chaque soir à 20:00 (Africa/Douala), en-tête `Authorization: Bearer <CRON_SECRET>`.
- Faire approuver le modèle `kaya_resume_quotidien` (texte dans `docs/WHATSAPP_TEMPLATES.md`) ; sans lui Zernio refusera l'envoi (noté « échec » dans `envois_whatsapp`).

## Fusion hors-ligne (v15) + plusieurs boutiques (v13)
- Migrations : aucune nouvelle ; ordre complet 14 → 23 (la 23 est `plusieurs_boutiques`). Le mode hors ligne n'a pas de migration.
- Correction à la fusion : une vente ou une dépense faite sans réseau porte maintenant sa boutique (`boutiqueId`). À l'envoi, le serveur l'enregistre dans cette boutique-là, même si l'utilisateur a changé de boutique entre-temps ; une boutique devenue inaccessible est refusée. Le catalogue gardé sur l'appareil retient aussi sa boutique. Les anciennes opérations sans boutique vont dans la boutique active.
- Tableau de bord : actualisation chaque minute (v15) conservée avec la vue consolidée et le choix de boutique (v13). La v16 avait le même code que la v15 (seules les images du catalogue manquaient) : rien à fusionner.

## Images du catalogue retirées du projet
Les photos (`catalogue/images/`) sont déjà dans Cloudflare R2 sous `catalogue/` : elles ne sont plus dans le zip. Le script `televerser_r2.mjs` n'est utile que pour ajouter de nouvelles images (recréer le dossier `catalogue/images/` à ce moment-là).

## Vérification PWA
Contrôlée en navigateur sur la version de production : manifeste, icônes (192, 512, maskable), icône iOS, service worker (enregistré, actif, en cache : page hors ligne, écran de vente hors ligne et 18 fichiers de code), bascule vers l'écran de vente hors ligne quand le réseau est coupé, aucune erreur console. Orientation du manifeste passée de « portrait » à « any » (ordinateur de comptoir ou tablette en paysage).

## Site : fonctions désormais livrées
Le résumé WhatsApp du soir et « plusieurs boutiques » ne portent plus la mention « Bientôt disponible » sur la page des tarifs. Restent à venir : devis et fournisseurs.

## Administrateur qui a aussi une boutique
Un compte inscrit dans `administrateurs_plateforme` accède à `/admin` même s'il gère une boutique : un lien « Administration » apparaît dans son menu, et « Ma boutique » dans l'espace admin. Un compte admin sans boutique arrive directement sur `/admin`.

## v18 — Choix du plan obligatoire (page /choisir-plan)
- `choisirPlanInitialAction` ajoutée dans `server/abonnement/actions.ts` (corrige l'échec de build Vercel).
- Migration 24 (idempotente) : colonne `plan_choisi_le` ; `choisir_plan` la renseigne. Tu peux supprimer `20_plan_obligatoire.sql` de ton dépôt (remplacée par la 24).
- Garde centrale : un propriétaire sans plan choisi est renvoyé vers `/choisir-plan` (`profil.planAChoisir`).
## Devis, proformas et bons de livraison (étape 14)

- Migration à appliquer : `supabase/migrations/20260101000026_devis.sql`.
- Plans Pro et Business : menu **Devis** (`/devis`), nouveau devis ou proforma, envoi, acceptation, conversion en vente, bons de livraison (`/devis/livraisons`) depuis un devis accepté ou un reçu.

## Fournisseurs et commandes (étape 15)

- Migration à appliquer : `supabase/migrations/20260101000027_fournisseurs.sql` (après la 21).
- Plans Pro et Business : menu **Fournisseurs** (`/fournisseurs`) : fiches, commandes, réception qui alimente le stock, dettes avec paiements partiels, historique des prix d'achat.

## v19 — Fusion fournisseurs/devis + transferts de stock
- Migrations à appliquer dans l'ordre : 24 (plan obligatoire), 25 (transferts de stock), 26 (devis), 27 (fournisseurs). Supprimer de ton dépôt les anciens fichiers `…020_plan_obligatoire.sql`, `…021_devis.sql`, `…022_fournisseurs.sql`, `…024_transferts_stock.sql` s'ils existent.
