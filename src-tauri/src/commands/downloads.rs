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

/// 把 url 流式下载写入 path（保存路径由前端 dialog 插件选择）。
/// 下载过程中持续 emit `download-progress` 事件供前端更新进度。
#[tauri::command]
pub async fn download_to(app: AppHandle, url: String, path: String) -> Result<(), String> {
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
  Ok(())
}