use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserApiInfo {
  pub id: String,
  pub name: String,
  pub description: String,
  pub author: String,
  pub homepage: String,
  pub version: String,
}

fn apis_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?
    .join("userApi");
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

fn meta_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  Ok(apis_dir(app)?.join("userApis.json"))
}

fn read_meta(app: &tauri::AppHandle) -> Vec<UserApiInfo> {
  let path = match meta_path(app) {
    Ok(p) => p,
    Err(_) => return vec![],
  };
  fs::read_to_string(path)
    .ok()
    .and_then(|s| serde_json::from_str(&s).ok())
    .unwrap_or_default()
}

fn write_meta(app: &tauri::AppHandle, list: &[UserApiInfo]) -> Result<(), String> {
  let path = meta_path(app)?;
  let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
  fs::write(path, json).map_err(|e| e.to_string())
}

fn parse_script_info(script: &str) -> Result<(String, String, String, String, String), String> {
  let block = regex_header(script).ok_or_else(|| "无效的自定义源文件".to_string())?;
  let mut name = String::new();
  let mut description = String::new();
  let mut author = String::new();
  let mut homepage = String::new();
  let mut version = String::new();
  for line in block.lines() {
    let line = line.trim().trim_start_matches('*').trim();
    if let Some(rest) = line.strip_prefix('@') {
      let mut parts = rest.splitn(2, char::is_whitespace);
      let key = parts.next().unwrap_or_default();
      let value = parts.next().unwrap_or_default().trim().to_string();
      match key {
        "name" => name = value,
        "description" => description = value,
        "author" => author = value,
        "homepage" => homepage = value,
        "version" => version = value,
        _ => {}
      }
    }
  }
  if name.is_empty() {
    name = format!("user_api_{}", chrono_now());
  }
  Ok((name, description, author, homepage, version))
}

fn regex_header(script: &str) -> Option<String> {
  let script = script.trim_start();
  if !script.starts_with("/*") {
    return None;
  }
  let end = script.find("*/")? + 2;
  Some(script[..end].to_string())
}

fn chrono_now() -> String {
  let dt = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  format!("{}", dt.as_millis())
}

#[tauri::command]
pub fn user_api_list(app: tauri::AppHandle) -> Result<Vec<UserApiInfo>, String> {
  Ok(read_meta(&app))
}

#[tauri::command]
pub fn user_api_import(app: tauri::AppHandle, script_content: String) -> Result<Vec<UserApiInfo>, String> {
  let (name, description, author, homepage, version) = parse_script_info(&script_content)?;

  let dir = apis_dir(&app)?;
  let id = format!("user_api_{}_{}", rand3(), chrono_now());

  let mut list = read_meta(&app);
  for api in &list {
    let existing = fs::read_to_string(dir.join(format!("{}.js", api.id))).unwrap_or_default();
    if existing == script_content {
      return Err(format!("导入失败，脚本内容与已有的源「{}」相同", api.name));
    }
  }

  let info = UserApiInfo {
    id: id.clone(),
    name,
    description,
    author,
    homepage,
    version,
  };
  fs::write(dir.join(format!("{}.js", id)), &script_content).map_err(|e| e.to_string())?;
  list.push(info.clone());
  write_meta(&app, &list)?;
  Ok(list)
}

#[tauri::command]
pub fn user_api_remove(app: tauri::AppHandle, ids: Vec<String>) -> Result<Vec<UserApiInfo>, String> {
  let dir = apis_dir(&app)?;
  let mut list = read_meta(&app);
  list.retain(|api| !ids.contains(&api.id));
  for id in &ids {
    let _ = fs::remove_file(dir.join(format!("{}.js", id)));
  }
  write_meta(&app, &list)?;
  Ok(list)
}

#[tauri::command]
pub fn user_api_get_script(app: tauri::AppHandle, id: String) -> Result<Option<String>, String> {
  let dir = apis_dir(&app)?;
  let path = dir.join(format!("{}.js", id));
  if !path.exists() {
    return Ok(None);
  }
  fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn user_api_get_all(app: tauri::AppHandle) -> Result<Vec<(UserApiInfo, String)>, String> {
  let dir = apis_dir(&app)?;
  let list = read_meta(&app);
  let mut result = vec![];
  for api in list {
    let path = dir.join(format!("{}.js", api.id));
    if let Ok(script) = fs::read_to_string(path) {
      result.push((api, script));
    }
  }
  Ok(result)
}

fn rand3() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let n = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .subsec_nanos()
    % 1000;
  format!("{:03}", n)
}