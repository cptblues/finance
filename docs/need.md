> **Où part l’argent, qu’est-ce qui revient souvent, et qu’est-ce qui change d’un mois à l’autre ?**

Voici les analyses les plus utiles pour ton app.

## 1. Vue mensuelle simple

La base du dashboard :

```txt
Revenus du mois
Dépenses du mois
Solde net
Taux d’épargne
Nombre de transactions
```

Exemple :

```txt
Revenus : 3 200 €
Dépenses : 2 450 €
Solde net : +750 €
Taux d’épargne : 23,4 %
```

Formule :

```ts
soldeNet = revenus - depenses;
tauxEpargne = soldeNet / revenus;
```

## 2. Dépenses par catégorie

Indispensable pour comprendre où part l’argent.

```txt
Logement       850 €
Alimentation   420 €
Transport      160 €
Loisirs        130 €
Santé           75 €
Abonnements     49 €
```

À afficher avec :

```txt
- donut chart
- bar chart
- tableau trié du plus gros au plus petit
```

C’est probablement l’analyse la plus importante de l’app.

## 3. Évolution mois par mois

Très utile pour voir les tendances.

```txt
Janvier   2 100 € dépensés
Février   2 350 €
Mars      2 800 €
Avril     2 200 €
Mai       2 450 €
```

Analyses possibles :

```txt
- dépenses en hausse ou en baisse
- revenus stables ou irréguliers
- solde net mensuel
- comparaison avec le mois précédent
- comparaison avec la moyenne des 3 ou 6 derniers mois
```

Exemple d’insight :

```txt
Tes dépenses ont augmenté de 18 % par rapport à ta moyenne des 3 derniers mois.
```

## 4. Détection des abonnements

Très utile pour une app de finances perso.

Détecter les opérations qui reviennent :

```txt
Spotify
Netflix
Canal+
Amazon Prime
Assurance
Téléphone
Salle de sport
```

Critères possibles :

```txt
Même libellé
Montant identique ou proche
Tous les mois
Même période du mois
```

Exemple :

```txt
Abonnements détectés :
- Spotify : 9,99 € / mois
- Netflix : 13,49 € / mois
- Téléphone : 19,99 € / mois

Total abonnements : 43,47 € / mois
Projection annuelle : 521,64 €
```

## 5. Détection des dépenses inhabituelles

Comparer une transaction avec l’historique.

Exemples :

```txt
Dépense inhabituelle : 250 € chez Electro Dépôt
Cette dépense est 4,2x supérieure à ta dépense moyenne en catégorie Équipement.
```

Ou :

```txt
Catégorie Transport en hausse de 62 % ce mois-ci.
```

C’est une fonctionnalité très “waouh” sans avoir besoin d’IA.

## 6. Top marchands / libellés

Pour voir les endroits où tu dépenses le plus.

```txt
Carrefour        286 €
Amazon           210 €
Uber Eats        94 €
SNCF             88 €
Spotify           9,99 €
```

À faire sur :

```txt
- le mois courant
- les 3 derniers mois
- l’année
```

Ça aide à repérer les habitudes de consommation.

## 7. Revenus récurrents

Détecter les entrées régulières :

```txt
Salaire
CAF
Remboursements
Virements réguliers
Loyers perçus
```

Utile pour calculer :

```txt
revenu mensuel moyen
revenu minimum observé
revenu maximum observé
stabilité des revenus
```

## 8. Solde net et capacité d’épargne

Une analyse simple mais puissante :

```txt
Revenus - Dépenses = capacité d’épargne
```

À afficher mois par mois :

```txt
Janvier   +420 €
Février   +180 €
Mars      -90 €
Avril     +650 €
Mai       +750 €
```

Tu peux ensuite calculer :

```txt
moyenne d’épargne mensuelle
meilleur mois
pire mois
taux d’épargne moyen
```

## 9. Dépenses fixes vs variables

Très utile pour comprendre ce qui est compressible.

### Dépenses fixes

```txt
Loyer
Assurance
Téléphone
Abonnements
Crédit
Électricité
Internet
```

### Dépenses variables

```txt
Courses
Restaurants
Shopping
Loisirs
Transport ponctuel
Santé
```

Analyse intéressante :

```txt
Dépenses fixes : 1 250 €
Dépenses variables : 780 €
```

Insight :

```txt
61 % de tes dépenses mensuelles sont fixes.
```

## 10. Budget par catégorie

Permettre à l’utilisateur de définir :

```txt
Alimentation : 400 € / mois
Loisirs : 150 € / mois
Transport : 120 € / mois
Shopping : 100 € / mois
```

Puis afficher :

```txt
Alimentation : 382 € / 400 € → OK
Loisirs : 178 € / 150 € → dépassé de 28 €
Transport : 96 € / 120 € → OK
```

Très utile pour rendre l’app actionnable.

## 11. Analyse de fin de mois

Une vue spéciale :

```txt
Il te reste 8 jours avant la fin du mois.
Tu as déjà dépensé 82 % de ton budget alimentation.
Ton rythme actuel estime une fin de mois à 470 € sur cette catégorie.
```

Sans prédiction compliquée, tu peux faire :

```ts
projection = dépensesActuelles / jourDuMois * nombreJoursDansMois;
```

## 12. Calendrier des dépenses

Afficher les dépenses sur un calendrier.

Utile pour voir :

```txt
- les jours où beaucoup de prélèvements tombent
- les périodes de dépenses fortes
- les fins de mois difficiles
- les revenus qui arrivent
```

Exemple :

```txt
Le 5 du mois : loyer
Le 10 : assurance
Le 15 : téléphone
Le 28 : salaire
```

## 13. Analyse des frais bancaires

Si les libellés le permettent :

```txt
Frais tenue de compte
Commission intervention
Agios
Cotisation carte
Frais retrait
```

Afficher :

```txt
Frais bancaires ce mois-ci : 7,90 €
Frais bancaires cette année : 63,20 €
```

C’est très utile parce que ces frais sont souvent invisibles.

## 14. Analyse des virements internes

Il faut éviter de fausser les stats.

Exemples :

```txt
Virement vers livret A
Virement entre comptes
Épargne automatique
Remboursement carte
```

Ces opérations ne sont pas forcément des dépenses réelles.

Il faudrait pouvoir les marquer comme :

```txt
transfert interne
épargne
à exclure des dépenses
```

## 15. Recherches et filtres avancés

Très important côté UX.

Filtres utiles :

```txt
période
montant minimum / maximum
catégorie
sous-catégorie
type d’opération
revenus uniquement
dépenses uniquement
transactions récurrentes
transactions non catégorisées
transactions exclues des stats
```

Tri utile :

```txt
date récente
date ancienne
montant croissant
montant décroissant
catégorie
libellé
```

## 16. Score de stabilité financière

Pas obligatoire en V1, mais intéressant.

Exemple simple :

```txt
Stabilité des revenus
Poids des charges fixes
Taux d’épargne moyen
Variation des dépenses
Présence de mois négatifs
```

Tu pourrais afficher quelque chose comme :

```txt
Stabilité : bonne
Charges fixes : élevées
Épargne : correcte
Risque fin de mois : faible
```

## 17. Résumé automatique du mois

Une page “bilan mensuel” :

```txt
En mai 2024 :
- tu as gagné 3 200 €
- tu as dépensé 2 450 €
- tu as épargné 750 €
- ta plus grosse dépense est Loyer : 750 €
- ta catégorie la plus élevée est Logement : 35 %
- tes dépenses ont baissé de 8 % par rapport à avril
- 3 abonnements ont été détectés
```

C’est le genre d’écran qui donne beaucoup de valeur à l’app.

## Les analyses que je mettrais en V1

Pour éviter de partir trop large, je ferais d’abord :

```txt
1. Revenus / dépenses / solde net
2. Dépenses par catégorie
3. Évolution mensuelle
4. Tableau filtrable des transactions
5. Top dépenses
6. Détection des abonnements
7. Budgets par catégorie
8. Marquage transfert interne / exclure des stats
```

## Le dashboard idéal

Je structurerais ton app comme ça :

```txt
Dashboard
├── KPIs principaux
│   ├── Revenus
│   ├── Dépenses
│   ├── Solde net
│   └── Taux d’épargne
│
├── Graphiques
│   ├── Revenus vs dépenses
│   ├── Dépenses par catégorie
│   └── Solde net dans le temps
│
├── Insights
│   ├── Abonnements détectés
│   ├── Dépenses inhabituelles
│   ├── Catégories en hausse
│   └── Budget dépassé
│
└── Transactions
    ├── Tableau
    ├── Filtres
    ├── Tris
    └── Catégorisation
```

La vraie valeur de ton app ne sera pas seulement d’afficher les transactions. Ce sera de transformer un CSV bancaire illisible en **bilan financier clair**, avec quelques insights directement exploitables.
