# Nouveautés (novembre 2026)

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
