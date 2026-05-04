# Etape 4 - Budgets, projections, calendrier et frais

## Objectif

Rendre l'application actionnable : suivre des budgets, anticiper la fin de mois, visualiser les jours importants et reperer les frais bancaires.

## Changements fonctionnels

- Activer une vue Budgets :
  - budget mensuel par categorie ;
  - montant consomme ;
  - reste disponible ;
  - depassement ;
  - progression visuelle.
- Ajouter analyse de fin de mois :
  - jours restants ;
  - depenses actuelles par categorie ;
  - projection simple de fin de mois ;
  - categories a risque de depassement.
- Ajouter calendrier des flux :
  - regroupement par jour ;
  - revenus, depenses et solde journalier ;
  - jours avec abonnements ou revenus recurrents ;
  - pics de depenses.
- Ajouter analyse des frais bancaires :
  - frais tenue de compte ;
  - commissions ;
  - agios ;
  - cotisations carte ;
  - frais retrait.

## Changements techniques

- Etendre `FinanceStore` avec un champ versionne `budgets`.
- Ajouter un type `Budget` minimal :
  - id ;
  - category ;
  - monthlyAmount ;
  - createdAt ;
  - updatedAt.
- Ajouter une migration de store local depuis `version: 1` vers la nouvelle version.
- Ajouter des fonctions pures :
  - `computeBudgetProgress`
  - `computeEndOfMonthProjection`
  - `computeCalendarSummary`
  - `detectBankFees`
- Garder les frais bancaires comme analyse derivee, non persistante.
- Ajouter une UI de creation, edition et suppression de budgets, avec sauvegarde locale.

## UX attendue

- Le menu Budgets devient actif.
- Chaque budget affiche clairement `depense / budget` et l'ecart restant ou depasse.
- La projection fin de mois doit etre presentee comme estimation simple, pas comme prediction certaine.
- Le calendrier doit rester lisible : un resume par jour et un detail au clic suffisent.
- Les frais bancaires detectes doivent renvoyer vers les transactions concernees.

## Tests a ajouter

- Cree un budget et calcule la consommation mensuelle par categorie.
- Calcule reste disponible et depassement.
- Projette la fin de mois avec `depensesActuelles / jourDuMois * joursDansMois`.
- Gere correctement le premier et le dernier jour du mois.
- Regroupe transactions par jour pour le calendrier.
- Detecte les frais bancaires par mots-cles de libelle.
- Migre un store `version: 1` vers la version avec budgets.

## Criteres d'acceptation

- L'utilisateur peut definir et modifier des budgets locaux.
- La vue Budgets explique les depassements sans calcul manuel.
- La projection fin de mois fonctionne sur le mois selectionne.
- Le calendrier met en evidence les jours financiers importants.
- Les frais bancaires sont detectes et consultables.
- `npm test` et `npm run build` passent.
