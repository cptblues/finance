# Etape 2 - Categories, marchands et abonnements

## Objectif

Renforcer les reponses aux deux questions centrales : ou part l'argent, et qu'est-ce qui revient souvent.

## Changements fonctionnels

- Completer les depenses par categorie :
  - conserver le donut existant ;
  - ajouter un bar chart des principales categories ;
  - ajouter un tableau trie du plus gros poste au plus petit.
- Ameliorer les top marchands :
  - normaliser les libelles marchands de facon plus robuste ;
  - regrouper les libelles proches ;
  - proposer les periodes mois courant, 3 derniers mois et annee.
- Renforcer la detection des abonnements :
  - detecter les depenses mensuelles avec libelle proche ;
  - accepter un montant identique ou proche ;
  - prendre en compte une periode similaire dans le mois ;
  - afficher total mensuel et projection annuelle.
- Garder les actions existantes : marquer manuellement une recurrence et ignorer un faux positif.

## Changements techniques

- Faire evoluer `normalizeMerchantLabel` pour mieux nettoyer les prefixes bancaires, numeros, villes et references courantes.
- Ajouter une fonction pure de regroupement marchand, distincte des categories :
  - entree : transactions ;
  - sortie : libelle marchand normalise, libelles sources, total, nombre, derniere date.
- Faire evoluer `detectRecurringExpenses` ou ajouter une nouvelle fonction `detectSubscriptions` si la logique devient differente des recurrences generiques.
- Ajouter un type d'analyse d'abonnement avec :
  - label ;
  - montant moyen ;
  - montant min/max ;
  - jour moyen du mois ;
  - nombre d'occurrences ;
  - mois couverts ;
  - projection annuelle ;
  - statut detecte, manuel ou ignore.
- Garder la persistence actuelle `recurrenceStatus` et `recurrenceId` pour les corrections utilisateur.

## UX attendue

- Le dashboard montre une lecture rapide des postes principaux sans ouvrir la page Categories.
- La vue Recurrents presente le total mensuel estime et la projection annuelle.
- Le top marchands ne doit pas etre pollue par des variations mineures de libelle bancaire.
- Les faux positifs doivent rester ignorables.

## Tests a ajouter

- Regroupe des libelles marchands proches sous une meme entree.
- Trie les marchands par total depense decroissant.
- Filtre les marchands sur mois courant, 3 derniers mois et annee.
- Detecte un abonnement mensuel avec montant stable.
- Detecte un abonnement avec petite variation de montant.
- Ne detecte pas une depense ponctuelle comme abonnement.
- Respecte les statuts manuel et ignore.

## Criteres d'acceptation

- Les categories principales sont visibles en donut, bar chart et tableau.
- Les top marchands donnent des regroupements exploitables.
- Les abonnements affichent total mensuel et projection annuelle.
- Les tests couvrent normalisation, regroupement et detection.
- `npm test` et `npm run build` passent.
