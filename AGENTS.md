# AGENTS.md

## Projet

Application Web personnelle d’analyse financière basée sur l’import de fichiers CSV exportés depuis un compte bancaire Caisse d’Épargne.

L’objectif de l’application est de permettre à l’utilisateur d’importer ses transactions bancaires, de les consulter, les filtrer, les trier, les catégoriser et d’obtenir des tableaux de bord financiers clairs : dépenses, revenus, catégories, statistiques mensuelles, tendances, soldes, récurrences et anomalies éventuelles.

L’application doit être pensée comme un outil de finances personnelles simple, fiable et lisible.

## Stack recommandée

Utiliser de préférence :

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Zod
- PapaParse
- TanStack Table
- Recharts
- date-fns

## Source de données principale

Les données viennent d’un export CSV Caisse d’Épargne.

Le CSV utilise le séparateur `;`.

Colonnes disponibles :

```txt
Date de comptabilisation
Libelle simplifie
Libelle operation
Reference
Informations complementaires
Type operation
Categorie
Sous categorie
Debit
Credit
Date operation
Date de valeur
Pointage operation
```

## Règles métier principales

### Débit, crédit et montant normalisé

Dans le CSV :

- `Debit` représente une sortie d’argent.
- `Credit` représente une entrée d’argent.
- Les montants peuvent être vides.
- Les montants peuvent utiliser le format français avec une virgule décimale.

Toujours convertir les montants en nombres JavaScript normalisés.

```ts
amount = credit - debit;
```

Donc :

- une dépense doit avoir un `amount` négatif ;
- un revenu doit avoir un `amount` positif ;
- un débit vide vaut `0` ;
- un crédit vide vaut `0`.

### Dates

Le CSV contient plusieurs dates :

- `Date operation` : date réelle de l’opération, à utiliser comme date principale d’analyse.
- `Date de comptabilisation` : date de comptabilisation bancaire.
- `Date de valeur` : date de valeur bancaire.

Pour les graphiques, filtres et statistiques, utiliser en priorité :

```ts
date = Date operation || Date de comptabilisation || Date de valeur;
```

Les dates doivent être normalisées au format ISO quand elles sont stockées.

### Libellés

Le CSV contient deux libellés :

- `Libelle simplifie` : libellé court à afficher dans l’interface.
- `Libelle operation` : libellé brut plus détaillé, utile pour la recherche, le debug, la déduplication et les règles automatiques.

Utiliser :

```ts
label = Libelle simplifie || Libelle operation;
rawLabel = Libelle operation;
```

### Catégories

Le CSV contient déjà :

- `Categorie`
- `Sous categorie`

Ces catégories doivent être conservées comme catégories bancaires d’origine.

Ne pas les écraser.

Si l’utilisateur modifie une catégorie dans l’application, stocker cette catégorie utilisateur séparément.

Exemple :

```ts
bankCategory
bankSubcategory
userCategoryId
```

Les catégories utilisateur ne doivent pas détruire les catégories fournies par la banque.

## Modèle de transaction normalisé

Utiliser une structure proche de celle-ci :

```ts
type Transaction = {
  id: string;
  userId: string;

  source: "caisse-epargne";

  fingerprint: string;

  date: string | null;
  bookingDate: string | null;
  operationDate: string | null;
  valueDate: string | null;

  label: string;
  rawLabel: string | null;

  reference: string | null;
  notes: string | null;

  operationType: string | null;

  bankCategory: string | null;
  bankSubcategory: string | null;

  userCategoryId: string | null;

  debit: number;
  credit: number;
  amount: number;

  isChecked: boolean;

  raw: Record<string, string>;

  createdAt: string;
  updatedAt: string;
};
```

## Mapping CSV vers transaction

Mapping recommandé :

```ts
const transaction = {
  source: "caisse-epargne",

  date: row["Date operation"] || row["Date de comptabilisation"] || row["Date de valeur"],

  bookingDate: row["Date de comptabilisation"] || null,
  operationDate: row["Date operation"] || null,
  valueDate: row["Date de valeur"] || null,

  label: row["Libelle simplifie"] || row["Libelle operation"] || "Transaction sans libellé",
  rawLabel: row["Libelle operation"] || null,

  reference: row["Reference"] || null,
  notes: row["Informations complementaires"] || null,

  operationType: row["Type operation"] || null,

  bankCategory: row["Categorie"] || null,
  bankSubcategory: row["Sous categorie"] || null,

  debit,
  credit,
  amount: credit - debit,

  isChecked: row["Pointage operation"] === "Oui",

  raw: row,
};
```

## Parsing des montants

Toujours gérer les formats français.

Exemple de fonction attendue :

```ts
function parseFrenchAmount(value?: string | null): number {
  if (!value) return 0;

  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();

  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}
```

## Déduplication

L’application doit éviter les doublons lors de plusieurs imports.

Ne jamais se baser uniquement sur le libellé.

Créer un `fingerprint` stable à partir des champs suivants :

```txt
Date operation
Libelle operation
Reference
Debit
Credit
```

Exemple :

```ts
const fingerprintSource = [
  row["Date operation"],
  row["Libelle operation"],
  row["Reference"],
  row["Debit"],
  row["Credit"],
].join("|");
```

Hasher ensuite cette chaîne pour créer un identifiant stable.

La base de données doit empêcher les doublons via une contrainte unique sur :

```txt
user_id + fingerprint
```

## Import CSV

Le flux d’import doit inclure :

1. Upload du fichier CSV.
2. Parsing du fichier avec séparateur `;`.
3. Validation des colonnes attendues.
4. Normalisation des lignes.
5. Aperçu avant import.
6. Affichage des erreurs éventuelles.
7. Détection des doublons.
8. Confirmation par l’utilisateur.
9. Import en base.
10. Résumé d’import.

Le résumé d’import doit afficher :

- nombre de lignes lues ;
- nombre de transactions valides ;
- nombre de doublons ignorés ;
- nombre d’erreurs ;
- montant total des crédits ;
- montant total des débits ;
- période couverte par le fichier.

## Tableaux

L’application doit proposer une vue tableau des transactions.

Le tableau doit permettre :

- tri par date ;
- tri par montant ;
- tri par catégorie ;
- tri par type d’opération ;
- recherche par libellé ;
- filtre par période ;
- filtre par catégorie ;
- filtre par sous-catégorie ;
- filtre par type d’opération ;
- filtre revenus / dépenses ;
- pagination ;
- sélection de transactions ;
- édition manuelle de la catégorie utilisateur.

Utiliser de préférence TanStack Table.

Le tableau doit toujours afficher au minimum :

- date ;
- libellé ;
- type d’opération ;
- catégorie ;
- sous-catégorie ;
- débit ;
- crédit ;
- montant normalisé.

## Statistiques et tableaux de bord

L’application doit afficher des statistiques utiles pour les finances personnelles.

Statistiques prioritaires :

- total des dépenses ;
- total des revenus ;
- solde net ;
- nombre de transactions ;
- dépense moyenne ;
- revenu moyen ;
- plus grosse dépense ;
- plus gros revenu ;
- évolution mensuelle des dépenses ;
- évolution mensuelle des revenus ;
- dépenses par catégorie ;
- dépenses par sous-catégorie ;
- revenus par catégorie ;
- répartition dépenses / revenus ;
- top marchands ou libellés ;
- transactions récurrentes potentielles.

## Graphiques

Utiliser Recharts pour les visualisations.

Graphiques recommandés :

- bar chart des dépenses mensuelles ;
- bar chart des revenus mensuels ;
- line chart du solde net mensuel ;
- pie chart ou donut chart des dépenses par catégorie ;
- bar chart des top catégories ;
- tableau des plus grosses dépenses ;
- évolution des dépenses par catégorie dans le temps.

Les graphiques doivent être lisibles, simples et utiles.

Ne pas surcharger l’interface avec trop de graphiques à la fois.

## Filtres globaux

Prévoir des filtres globaux applicables au dashboard :

- période ;
- mois ;
- année ;
- catégorie ;
- sous-catégorie ;
- type d’opération ;
- montant minimum ;
- montant maximum ;
- revenus uniquement ;
- dépenses uniquement.

Les filtres globaux doivent affecter les tableaux, les stats et les graphiques.

## Catégorisation

L’application doit permettre à l’utilisateur de modifier ou corriger les catégories.

Les catégories bancaires d’origine doivent rester intactes.

Prévoir à terme :

- catégories personnalisées ;
- règles automatiques basées sur le libellé ;
- regroupement de sous-catégories ;
- exclusion de certaines transactions des statistiques ;
- marquage de transactions comme internes ou transferts.

## Données brutes

Toujours conserver la ligne CSV brute dans un champ `raw`.

Ne jamais supprimer les données brutes importées.

Cela permet :

- de corriger des bugs d’import ;
- de refaire une normalisation plus tard ;
- de vérifier les informations originales ;
- de supporter de nouveaux champs ultérieurement.

## Base de données

Tables recommandées :

```txt
transactions
imports
categories
category_rules
```

### transactions

Champs importants :

```txt
id
user_id
import_id
source
fingerprint
date
booking_date
operation_date
value_date
label
raw_label
reference
notes
operation_type
bank_category
bank_subcategory
user_category_id
debit
credit
amount
is_checked
raw
created_at
updated_at
```

### imports

Stocker les informations sur chaque import CSV :

```txt
id
user_id
source
file_name
file_hash
rows_count
valid_rows_count
duplicate_rows_count
error_rows_count
period_start
period_end
created_at
```

## Sécurité et confidentialité

Les données sont sensibles car elles viennent d’un compte bancaire.

Règles impératives :

- Ne jamais logger les transactions complètes en production.
- Ne jamais logger les libellés bancaires complets en production.
- Ne jamais exposer les données d’un autre utilisateur.
- Ne jamais envoyer les transactions vers un service externe sans consentement explicite.
- Ne jamais mettre de clé API dans le frontend.
- Activer Row Level Security sur toutes les tables Supabase.
- Toutes les requêtes doivent être filtrées par `user_id`.
- Prévoir la suppression des imports.
- Prévoir la suppression du compte et des données associées.
- Éviter les trackers inutiles.

## Supabase

Si Supabase est utilisé :

- activer RLS sur toutes les tables ;
- ajouter une colonne `user_id` sur toutes les tables utilisateur ;
- ajouter des policies par utilisateur ;
- indexer les champs utilisés dans les filtres ;
- ajouter une contrainte unique sur `user_id + fingerprint`.

Index recommandés :

```sql
create index on transactions (user_id, date);
create index on transactions (user_id, amount);
create index on transactions (user_id, bank_category);
create index on transactions (user_id, bank_subcategory);
create index on transactions (user_id, operation_type);
create unique index on transactions (user_id, fingerprint);
```

## Validation

Utiliser Zod pour valider :

- les lignes CSV ;
- les transactions normalisées ;
- les paramètres de filtres ;
- les formulaires ;
- les imports.

Toute donnée venant du CSV doit être considérée comme non fiable jusqu’à validation.

## Tests

Ajouter des tests pour :

- parsing CSV avec `;` ;
- parsing des montants français ;
- parsing des dates ;
- calcul `amount = credit - debit` ;
- détection des doublons ;
- mapping des colonnes Caisse d’Épargne ;
- validation de lignes incomplètes ;
- import avec débit vide ;
- import avec crédit vide ;
- import avec caractères spéciaux dans les libellés.

## UX attendue

L’interface doit être claire et orientée analyse.

Prévoir les états :

- chargement ;
- erreur ;
- vide ;
- aucun résultat après filtre ;
- import réussi ;
- import partiellement réussi ;
- doublons détectés.

L’utilisateur doit pouvoir comprendre rapidement :

- combien il dépense ;
- combien il gagne ;
- où part son argent ;
- quelles catégories coûtent le plus ;
- quelles transactions sont inhabituelles ;
- comment ses dépenses évoluent dans le temps.

## Principes de développement

Toujours privilégier :

- TypeScript strict ;
- fonctions pures pour le parsing ;
- logique métier séparée de l’UI ;
- composants réutilisables ;
- noms explicites ;
- tests sur les transformations de données ;
- migrations SQL versionnées ;
- accessibilité correcte ;
- interface responsive.

Éviter :

- logique métier directement dans les composants React ;
- duplication du parsing ;
- mutations silencieuses des données importées ;
- suppression des données brutes ;
- hypothèses implicites sur le format bancaire ;
- dépendances inutiles ;
- dashboards trop chargés.

## Priorité de la V1

La première version doit se concentrer sur :

1. Import CSV fiable.
2. Normalisation des transactions.
3. Détection des doublons.
4. Tableau filtrable et triable.
5. Statistiques de base.
6. Graphiques simples.
7. Catégories bancaires visibles.
8. Catégories utilisateur modifiables.
9. Sécurité des données utilisateur.

Ne pas complexifier la V1 avec des fonctionnalités avancées tant que l’import et l’analyse de base ne sont pas solides.

## Fonctionnalités futures possibles

À envisager après la V1 :

- règles automatiques de catégorisation ;
- détection des abonnements ;
- détection des dépenses inhabituelles ;
- budgets mensuels ;
- alertes de dépassement ;
- comparaison mois par mois ;
- export des données enrichies ;
- support OFX ;
- support QIF ;
- multi-comptes ;
- rapprochement de transactions ;
- projections de trésorerie.
