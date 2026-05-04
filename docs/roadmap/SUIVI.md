# Suivi roadmap

Derniere mise a jour : 2026-05-02

## Statut global

| Etape | Statut | Resume | Prochaine action |
| --- | --- | --- | --- |
| 00 - Audit besoins vs implementation | Termine | Analyse de `docs/need.md` comparee a l'application existante. | Maintenir a jour si le besoin change. |
| 01 - Socle dashboard mensuel | Termine | Dashboard mensuel, comparaisons et suivi des KPI. | Demarrer la planification de l'etape 02. |
| 02 - Categories, marchands et abonnements | Termine | Renforcer les regroupements categories, marchands et abonnements. | Demarrer la planification de l'etape 03. |
| 03 - Comparaisons, anomalies et revenus recurrents | Termine | Expliquer les variations et detecter revenus/anomalies. | Demarrer la planification de l'etape 04. |
| 04A - Budgets et projections | Termine | Ajouter budgets persistants et projection de fin de mois. | Demarrer la planification de 04B. |
| 04B - Calendrier et frais bancaires | Termine | Ajouter calendrier des flux et detection de frais bancaires. | Roadmap V1 issue de `need.md` terminee. |
| V1.1A - Dette technique et preparation bilan mensuel | Termine | Lazy loading, chunks Vite et donnees du futur bilan mensuel. | Demarrer la planification de V1.1B. |

## Prochaine etape active

Etape : `V1.1B - Bilan mensuel automatique`

Objectif : creer une synthese mensuelle claire a partir de `computeMonthlyReportData`.

V1.1A terminee :

- Lazy loading des vues principales.
- Chunks Vite separes : `vendor`, `charts`, `tables`, vues chargees a la demande.
- Fonction `computeMonthlyReportData` disponible pour le bilan mensuel.
- Build avant : chunk JS principal 852.66 kB, gzip 237.99 kB.
- Build apres : plus gros chunk `vendor` 390.57 kB, `charts` 338.00 kB, entree principale 41.27 kB.

Verification attendue :

- `npm test`
- `npm run build`
- `cargo check`

Prochaine implementation :

- Ajouter une vue ou section "Bilan mensuel".
- Afficher revenus, depenses, epargne, plus grosse depense, categorie principale, recurrents, anomalies et budgets.
- Reutiliser les donnees deja centralisees dans `computeMonthlyReportData`.
