use futures_util::StreamExt;
use serde::Serialize;
use std::fs::File;
use std::io::Write;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
struct DownloadProgress {
  url: String,
  percent: u8,
}

/// 弹出系统「另存为」对话框选择保存路径，流式下载写入文件。
/// 返回保存的完整路径；用户取消时返回 "__cancelled__"。
#[tauri::command]
pub async fn download_song(
  app: AppHandle,
  url: String,
  filename: Option<String>,
) -> Result<String, String> {
  let mut dialog = rfd::FileDialog::new();
  if let Some(name) = filename {
    if !name.trim().is_empty() {
      dialog = dialog.set_file_name(name.trim().to_string());
    }
  }
  let Some(path) = dialog.save_file() else {
    return Ok("__cancelled__".to_string());
  };

  let resp = reqwest::get(&url).await.map_err(|e| format!("请求失败: {e}"))?;
  if !resp.status().is_success() {
    return Err(format!("服务端返回 {}", resp.status()));
  }
  let total = resp.content_length().unwrap_or(0);
  let mut file = File::create(&path).map_err(|e| format!("无法创建文件: {e}"))?;
  let mut stream = resp.bytes_stream();
  let mut written: u64 = 0;
  while let Some(chunk) = stream.next().await {
    let chunk = chunk.map_err(|e| format!("下载中断: {e}"))?;
    file.write_all(&chunk).map_err(|e| format!("写入失败: {e}"))?;
    written += chunk.len() as u64;
    if total > 0 {
      let percent = ((written * 100) / total).min(99) as u8;
      let _ = app.emit(
        "download-progress",
        DownloadProgress { url: url.clone(), percent },
      );
    }
  }
  let _ = app.emit(
    "download-progress",
    DownloadProgress { url: url.clone(), percent: 100 },
  );
  Ok(path.to_string_lossy().into_owned())
}