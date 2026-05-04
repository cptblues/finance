# Etape 1 - Socle dashboard mensuel

## Objectif

Rendre le dashboard mensuel explicite, fiable et comparable. L'utilisateur doit comprendre rapidement combien il a gagne, depense, epargne, et comment le mois se situe par rapport aux mois precedents.

## Changements fonctionnels

- Ajouter une lecture mensuelle claire : revenus du mois, depenses du mois, solde net, taux d'epargne, nombre de transactions.
- Afficher le mois courant selectionne comme contexte principal du dashboard quand un mois est choisi.
- Ajouter une comparaison avec le mois precedent : ecart revenus, ecart depenses, ecart solde, variation du taux d'epargne.
- Ajouter une comparaison avec la moyenne des 3 derniers mois et des 6 derniers mois quand l'historique le permet.
- Ajouter les meilleurs et pires mois observes selon le solde net.

## Changements techniques

- Etendre `src/lib/analysis.ts` avec des fonctions pures dediees aux agregats mensuels :
  - `computeMonthlySummary(transactions, month)`
  - `computeMonthlyTrend(transactions)`
  - `computeMonthlyBenchmarks(transactions, month)`
- Reutiliser `MonthlyPoint` ou creer un type plus riche si necessaire :
  - revenus
  - depenses
  - solde net
  - taux d'epargne
  - nombre de transactions
- Garder le stockage inchange : aucun nouveau champ persiste n'est requis pour cette etape.
- Adapter `Dashboard` pour presenter les KPI dans un contexte mensuel explicite.
- Eviter de dupliquer les calculs entre dashboard et page analyses.

## UX attendue

- Si aucun mois n'est selectionne, afficher une synthese sur la periode filtree avec un libelle clair.
- Si un mois est selectionne, afficher les comparaisons uniquement quand le mois precedent ou les moyennes existent.
- Si les revenus sont nuls, le taux d'epargne doit etre affiche comme non applicable plutot que `0 %` trompeur.
- Les variations positives ou negatives doivent etre lisibles avec les conventions existantes de couleurs.

## Tests a ajouter

- Calcule les revenus, depenses, solde net et nombre de transactions pour un mois donne.
- Calcule le taux d'epargne `soldeNet / revenus` quand les revenus sont positifs.
- Retourne un taux d'epargne non applicable quand les revenus sont nuls.
- Compare correctement un mois avec le mois precedent.
- Calcule une moyenne 3 mois et 6 mois en ignorant les mois absents.
- Identifie meilleur et pire mois selon le solde net.

## Criteres d'acceptation

- Les KPI mensuels ne dependent pas d'une interpretation implicite des filtres.
- L'utilisateur voit directement si le mois est meilleur ou pire que les mois precedents.
- Tous les calculs mensuels sont couverts par tests unitaires.
- `npm test` et `npm run build` passent.
