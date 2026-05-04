# Audit besoins vs implementation

Source besoin : `docs/need.md`.

Cible retenue : conserver l'application locale actuelle, basee sur Vite, React, Tauri et sauvegarde JSON locale. Cette roadmap ne prevoit pas de migration Next.js, Supabase ou PostgreSQL.

## Synthese actuelle

L'application couvre deja le socle V1 technique : import CSV, normalisation, deduplication, stockage local, filtres, tableau de transactions, categories, dashboard, top libelles, recurrence de depenses et comparaison mensuelle simple.

Le besoin exprime dans `need.md` va plus loin sur l'analyse : comprendre les tendances, detecter les anomalies, isoler les revenus recurrents, differencier fixe et variable, suivre des budgets, projeter la fin de mois, visualiser un calendrier et analyser les frais bancaires.

## Cartographie fonctionnelle

| Besoin `need.md` | Etat | Implementation actuelle | Ecart principal |
| --- | --- | --- | --- |
| Vue mensuelle simple | Partiel | Cartes revenus, depenses, solde net, epargne sur la selection filtree | Le contexte mensuel n'est pas explicite partout, pas de comparaison au mois precedent |
| Depenses par categorie | Partiel | Donut chart, legende, page categories, tableau par categorie | Pas de bar chart ni de tableau global trie dedie dans le dashboard |
| Evolution mois par mois | Partiel | Points quotidiens et solde cumule, comparaison de deux mois | Pas de serie mensuelle visible pour depenses/revenus/net ni moyenne 3/6 mois |
| Detection des abonnements | Partiel | Detection de depenses recurrentes par libelle normalise, marquage manuel/ignore | Pas de tolerance montant/jour du mois, pas de notion d'abonnement totalisee en dashboard |
| Depenses inhabituelles | Partiel faible | Insight base sur la plus grosse depense | Pas de comparaison a l'historique categorie/marchand |
| Top marchands/libelles | Partiel | Top couts par libelle exact sur la selection | Pas de normalisation marchand robuste ni vues mois/3 mois/annee |
| Revenus recurrents | Absent | Les revenus sont comptabilises dans les stats | Pas de detection de revenus reguliers ni stabilite des revenus |
| Solde net et capacite d'epargne | Partiel | Solde net et taux d'epargne affiches | Pas d'analyse mensuelle moyenne, meilleur/pire mois |
| Depenses fixes vs variables | Absent | Recurrences de depenses disponibles | Pas de classification fixe/variable |
| Budget par categorie | Absent | Menu Budgets desactive | Pas de modele budget ni vue de suivi |
| Analyse de fin de mois | Absent | Aucun calcul de projection | Pas de projection par rythme journalier |
| Calendrier des depenses | Absent | Points quotidiens calcules pour graphiques | Pas de vue calendrier ni regroupement par jour du mois |
| Frais bancaires | Absent | Libelles/categories disponibles | Pas de detection dediee par mots-cles |

## Capacites techniques deja disponibles

- `src/lib/csv-import.ts` gere les imports Caisse d'Epargne et Trade Republic, les montants, les dates, les fingerprints et les doublons.
- `src/lib/analysis.ts` contient deja les agregats principaux : filtres, stats, points quotidiens, categories, marchands, insights, recurrences et comparaisons de mois.
- `src/components/TransactionsTable.tsx` fournit une table TanStack triable, paginee, editable et annotee.
- `src/components/Dashboard.tsx` affiche les KPI principaux, categories, solde cumule, insights et top couts.
- `src/components/CategoriesPage.tsx`, `RecurringPage.tsx` et `AnalysisPage.tsx` couvrent deja une partie du besoin analytique.
- `src/lib/finance-store.ts` centralise la persistence locale et peut etre etendu avec de nouveaux champs versionnes.

## Risques et priorites

- Priorite 1 : clarifier les indicateurs mensuels avant d'ajouter des analyses avancees.
- Priorite 2 : renforcer categories, marchands et abonnements, car ce sont les questions les plus frequentes de l'utilisateur.
- Priorite 3 : ajouter anomalies et revenus recurrents une fois les agrégats mensuels fiables.
- Priorite 4 : ajouter budgets, projections, calendrier et frais bancaires, qui demandent de nouveaux modeles ou ecrans.

## Definition de fini globale

- Chaque nouvelle analyse est calculee dans une fonction pure testee.
- Les composants React consomment des donnees deja preparees, sans logique metier lourde.
- Les filtres globaux continuent d'impacter les vues principales.
- Les donnees restent locales et exportables en JSON.
- Les tests Vitest couvrent les cas limites avant validation de chaque etape.
