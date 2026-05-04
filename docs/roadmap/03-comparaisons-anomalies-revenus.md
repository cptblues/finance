# Etape 3 - Comparaisons, anomalies et revenus recurrents

## Objectif

Expliquer ce qui change d'un mois a l'autre et detecter les elements inhabituels sans utiliser d'IA externe.

## Changements fonctionnels

- Ameliorer la page Analyses :
  - comparaison depenses, revenus, solde et taux d'epargne ;
  - categories en hausse ou baisse ;
  - nouveaux marchands du mois ;
  - marchands disparus ;
  - comparaison avec moyenne 3 ou 6 mois.
- Ajouter detection de depenses inhabituelles :
  - transaction superieure a la moyenne de sa categorie ;
  - transaction superieure a la moyenne du marchand ;
  - categorie en forte hausse sur le mois.
- Ajouter revenus recurrents :
  - detection des entrees regulieres ;
  - revenu moyen, minimum, maximum ;
  - indicateur simple de stabilite.
- Ajouter des insights plus utiles et explicables dans le dashboard.

## Changements techniques

- Ajouter des fonctions pures dans `src/lib/analysis.ts` ou un module dedie :
  - `computeCategoryDeltas`
  - `detectUnusualExpenses`
  - `detectRecurringIncome`
  - `computeIncomeStability`
- Reutiliser les fonctions de normalisation marchand pour comparer les depenses par libelle.
- Ajouter des types dedies :
  - `ExpenseAnomaly`
  - `RecurringIncome`
  - `IncomeStability`
  - `AnalysisInsight`
- Garder tous les seuils constants et documentes dans le code pour eviter des comportements implicites.
- Ne pas persister les anomalies : elles sont derivees des transactions.

## UX attendue

- La page Analyses doit expliquer les ecarts avec des libelles courts et actionnables.
- Chaque anomalie affiche la raison : montant x fois superieur a la moyenne, categorie en hausse, nouveau marchand.
- Les revenus recurrents doivent etre separes des abonnements de depenses.
- Les insights doivent rester peu nombreux et priorises.

## Tests a ajouter

- Detecte une transaction anormalement elevee par rapport a sa categorie.
- Detecte une transaction anormalement elevee par rapport a son marchand.
- Detecte une categorie en forte hausse entre deux mois.
- Ne signale pas d'anomalie quand l'historique est insuffisant.
- Detecte un revenu recurrent mensuel.
- Calcule min, max, moyenne et stabilite des revenus.
- Compare un mois a la moyenne des 3 ou 6 derniers mois.

## Criteres d'acceptation

- La page Analyses permet d'identifier les changements majeurs sans lire toutes les transactions.
- Les anomalies sont explicables et testees.
- Les revenus recurrents ne sont pas melanges aux depenses recurrentes.
- Les seuils de detection sont centralises.
- `npm test` et `npm run build` passent.
