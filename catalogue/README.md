# Catalogue modèle

Produits courants prêts à cocher à l'ouverture d'une boutique (écran `/demarrage`, première étape après l'inscription,
puis bouton « Catalogue modèle » dans Stock). Le commerçant coche ce qu'il vend et saisit ses prix ; tout reste modifiable ensuite.

## Fonctionnement
- Données : `lib/catalogue/lot-N.json` (générées depuis `catalogue/source/lot-N.csv`), assemblées dans `lib/catalogue/index.ts`.
- Photos : `catalogue/images/<nom>.webp` (800 px) et `<nom>-v.webp` (vignette 200 px), envoyées **une seule fois dans R2** sous `catalogue/`
  (`node catalogue/outils/televerser_r2.mjs`) et partagées par toutes les boutiques : aucune copie par boutique, rien dans Supabase
  (la base ne garde que la clé `catalogue/<nom>.webp`, acceptée par la migration 16). Servies par `/img/catalogue/…`, cache d'une semaine.
- Import : action `server/catalogue/actions.ts` -> fonction SQL `importer_catalogue` (une transaction, tout ou rien, jamais de doublon).
  Le serveur ne reprend du navigateur que le nom, les prix et la photo : unités, catégories, marques et images viennent du catalogue.
- Un produit coché sans aucun prix de vente est créé masqué (jamais vendu à 0 FCFA).
- Produits sans photo : `image` est `null` dans le lot ; la photo s'ajoute dans l'assistant ou plus tard dans la fiche produit.

## Ajouter un lot
1. Déposer le CSV dans `catalogue/source/lot-N.csv`.
2. `python3 catalogue/outils/csv_vers_json.py catalogue/source/lot-N.csv lib/catalogue/lot-N.json`
3. Créer `catalogue/images-lot-N.json` (ref -> nom du fichier source, `null` si pas d'image), comme `images-lot-1.json`.
4. `python3 catalogue/outils/preparer_images.py <dossier_images> catalogue/images-lot-N.json lib/catalogue/lot-N.json`
5. Importer le lot dans `lib/catalogue/index.ts` (tableau `LOTS`).
6. Envoyer les nouvelles images : `node catalogue/outils/televerser_r2.mjs` (saute celles déjà à jour). À faire avant de déployer le lot.
