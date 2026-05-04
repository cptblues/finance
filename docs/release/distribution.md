# Distribution desktop

Cette application est distribuable avec Tauri v2 via GitHub Releases.

## Cibles

- Windows: installer NSIS `.exe`
- macOS: image disque `.dmg` Intel et Apple Silicon
- Linux: `.AppImage`, `.deb`, `.rpm`

Les builds Windows et macOS doivent passer par des runners natifs. Le workflow `.github/workflows/release.yml` lance donc une matrice GitHub Actions sur Linux, Windows et macOS.

## Premiere configuration

1. La paire de cles updater a ete generee localement dans un dossier ignore:

```bash
.tauri-keys/finance-dashboard.key
.tauri-keys/finance-dashboard.key.pub
```

La cle publique est deja copiee dans `src-tauri/tauri.conf.json`.

2. Ajouter ces secrets GitHub dans le repository:

- `TAURI_SIGNING_PRIVATE_KEY`: contenu de `.tauri-keys/finance-dashboard.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: vide, car la cle locale a ete generee sans mot de passe

La cle privee ne doit jamais etre commit. Elle est ignoree par `.gitignore` via `*.key` et `.tauri-keys`.

3. Verifier l'endpoint updater dans `src-tauri/tauri.conf.json`:

```json
"https://github.com/kpoulet/finance/releases/latest/download/latest.json"
```

Remplacer `kpoulet/finance` si le repository GitHub final a un autre owner/name.

## Publier une version

1. Mettre a jour la version dans:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

2. Valider localement:

```bash
npm test -- --run
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Pour tester un bundle local signe avec la cle ignoree:

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat .tauri-keys/finance-dashboard.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD= \
npm run tauri -- build --debug --bundles deb
```

3. Creer et pousser un tag SemVer:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Le workflow cree la release GitHub, ajoute les installers et publie `latest.json` pour l'updater.

## Mises a jour

L'application expose un bouton "Rechercher une mise a jour" dans la barre de statut. En version desktop installee, il consulte `latest.json`, telecharge l'update signee et lance l'installation.

Important: ne change pas `identifier` apres une premiere distribution publique. Cet identifiant controle aussi l'emplacement des donnees locales; le changer peut donner l'impression que les donnees ont disparu apres mise a jour.

L'identifiant actuel est conserve a `local.finance.dashboard` pour ne pas deplacer les donnees deja creees localement. Si tu veux le remplacer par un identifiant public du type `com.kpoulet.finance-dashboard`, il faut le faire avant de distribuer une premiere version a des utilisateurs, ou prevoir une migration de donnees.

## Notes macOS

Les builds macOS non signes ou non notarises peuvent afficher des avertissements Gatekeeper. Pour une distribution publique large, il faudra ajouter la signature Apple Developer ID et la notarization dans le workflow.
