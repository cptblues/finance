# Finance Dashboard Local

Application locale d'analyse de CSV Caisse d'Epargne.

## Fonctionnalites V1

- Import CSV avec separateur `;`.
- Normalisation des dates, montants francais, debit/credit et montant net.
- Deduplication par fingerprint stable.
- Sauvegarde locale via Tauri dans un fichier JSON applicatif.
- Fallback navigateur via `localStorage` pendant le developpement web.
- Tableau triable, filtrable et annotable.
- Dashboard revenus, depenses, solde net, evolution mensuelle, categories et top libelles.

## Commandes

```bash
npm install
npm run dev
npm run test
npm run build
npm run tauri dev
```

## Prerequis desktop

La partie React fonctionne avec Node.js. Pour lancer l'application desktop Tauri, Rust doit aussi etre installe sur la machine.

## Donnees

Les transactions restent locales. Aucun backend et aucun appel reseau applicatif ne sont utilises pour analyser les CSV.
