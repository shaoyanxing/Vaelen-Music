use serde_json::Value;
use std::fs;
use tauri::Manager;

fn settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir.join("settings.json"))
}

fn read_settings(app: &tauri::AppHandle) -> Value {
  let path = match settings_path(app) {
    Ok(p) => p,
    Err(_) => return Value::Object(Default::default()),
  };
  fs::read_to_string(path)
    .ok()
    .and_then(|s| serde_json::from_str(&s).ok())
    .unwrap_or_else(|| Value::Object(Default::default()))
}

#[tauri::command]
pub fn settings_get(app: tauri::AppHandle, key: Option<String>) -> Value {
  let settings = read_settings(&app);
  match key {
    Some(k) => settings.get(&k).cloned().unwrap_or_else(|| Value::Null),
    None => settings,
  }
}

#[tauri::command]
pub fn settings_set(app: tauri::AppHandle, key: String, value: Value) -> Result<(), String> {
  let path = settings_path(&app)?;
  let mut settings = read_settings(&app);
  if let Value::Object(map) = &mut settings {
    if value.is_null() {
      map.remove(&key);
    } else {
      map.insert(key, value);
    }
  }
  fs::write(path, settings.to_string()).map_err(|e| e.to_string())
}