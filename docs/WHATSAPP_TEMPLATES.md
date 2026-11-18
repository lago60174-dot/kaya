# Modèles WhatsApp d'abonnement (à faire approuver par Meta via Zernio)

Catégorie **Utilitaire**, langue **fr**. Variables : {{1}} boutique · {{2}} montant · {{3}} date d'échéance · {{4}} lien de paiement.

| Étape | Nom du modèle                  | Texte                                                                                                                                                                              |
| ----- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3   | `kaya_abonnement_rappel`       | Bonjour, l'abonnement Kaya de {{1}} ({{2}}) arrive à échéance le {{3}}. Réglez-le en un clic par Mobile Money : {{4}}                                                              |
| J     | `kaya_abonnement_echeance`     | Bonjour, l'abonnement Kaya de {{1}} ({{2}}) est à régler aujourd'hui ({{3}}). Payer par Mobile Money : {{4}}                                                                       |
| J+2   | `kaya_abonnement_retard`       | Bonjour, l'abonnement Kaya de {{1}} ({{2}}), échu le {{3}}, n'est pas encore réglé. Votre accès reste ouvert quelques jours. Régler maintenant : {{4}}                             |
| J+5   | `kaya_abonnement_dernier_jour` | Bonjour, dernier rappel : sans règlement de l'abonnement Kaya de {{1}} ({{2}}, échu le {{3}}), l'application passera en lecture seule. Vos données sont conservées. Régler : {{4}} |

Les noms doivent correspondre exactement à `lib/zernio/modeles.ts`.

## Résumé quotidien (à faire approuver aussi)

Catégorie **Utilitaire**, langue **fr**, nom exact `kaya_resume_quotidien`. Variables : {{1}} boutique · {{2}} date · {{3}} ventes du jour · {{4}} nombre de ventes · {{5}} produit le plus vendu · {{6}} points à surveiller.

> Bonjour, résumé Kaya de {{1}} pour le {{2}} : {{3}} de ventes ({{4}}). Produit le plus vendu : {{5}}. À surveiller : {{6}}. Détails dans l'application Kaya.
