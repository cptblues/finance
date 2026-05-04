use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FinanceStore {
    version: u8,
    transactions: Vec<serde_json::Value>,
    imports: Vec<serde_json::Value>,
    user_categories: Vec<String>,
    #[serde(default)]
    budgets: Vec<serde_json::Value>,
    updated_at: String,
}

fn empty_store() -> FinanceStore {
    FinanceStore {
        version: 2,
        transactions: vec![],
        imports: vec![],
        user_categories: vec![],
        budgets: vec![],
        updated_at: chrono_like_now(),
    }
}

fn chrono_like_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| format!("unix-{}", duration.as_secs()))
        .unwrap_or_else(|_| "unix-0".to_string())
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Impossible de trouver le dossier app data: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Impossible de creer le dossier app data: {error}"))?;
    Ok(dir.join("finance-store.json"))
}

#[tauri::command]
fn load_store(app: AppHandle) -> Result<FinanceStore, String> {
    let path = store_path(&app)?;
    if !path.exists() {
        return Ok(empty_store());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Impossible de lire la sauvegarde: {error}"))?;
    serde_json::from_str(&content).map_err(|error| format!("Sauvegarde JSON invalide: {error}"))
}

#[tauri::command]
fn save_store(app: AppHandle, store: FinanceStore) -> Result<(), String> {
    let path = store_path(&app)?;
    let content = serde_json::to_string_pretty(&store)
        .map_err(|error| format!("Impossible de serialiser: {error}"))?;
    fs::write(&path, content).map_err(|error| format!("Impossible d'ecrire la sauvegarde: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_store, save_store])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
