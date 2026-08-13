mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      commands::lx_request::lx_request,
      commands::user_api::user_api_list,
      commands::user_api::user_api_import,
      commands::user_api::user_api_remove,
      commands::user_api::user_api_get_script,
      commands::user_api::user_api_get_all,
      commands::settings::settings_get,
      commands::settings::settings_set,
      commands::downloads::download_to,
    ]);

  let builder = builder
    .plugin(tauri_plugin_dialog::init());

  #[cfg(debug_assertions)]
  let builder = builder
    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build());

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}