# Refonte UI Kaya

## Direction artistique

- **Marque :** Kaya — « Gérez. Vendez. Grandissez. »
- **Couleur principale :** orange chaud (`#FF7900`), avec un orange profond pour les actions (`#E65F00`).
- **Palette d'accompagnement :** bleu nuit (`#17233D`), blanc, ivoire (`#FFF8F1`), gris doux et couleurs d'état accessibles.
- **Surfaces :** cartes blanches, bordures discrètes, rayons généreux et ombres légères.
- **Typographie :** système sans-serif pour conserver un chargement rapide et une bonne lisibilité sur les téléphones Android modestes.

## Comportement responsive

- Sur ordinateur : navigation latérale bleu nuit avec en-tête de marque orange, contenu fluide et largeur maximale confortable.
- Sur téléphone : barre supérieure Kaya orange, navigation fixe à cinq entrées, zones tactiles généreuses et contenu en une colonne.
- L'écran de vente passe en catalogue + panier sur grand écran et en sections empilées sur téléphone. La validation reste accessible dans une barre fixe.

## Principes d'implémentation

La refonte utilise les composants et les données existants. Elle ne remplace ni Supabase, ni les règles d'accès, ni les actions serveur, ni les calculs métier. Les nouvelles classes `kaya-*` isolent les styles de l'espace de gestion afin de ne pas imposer cette identité à la vitrine publique ou aux reçus imprimables.
