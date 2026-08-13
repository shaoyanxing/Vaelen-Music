use base64::Engine;
use encoding_rs::{Encoding, GBK, UTF_8};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct LxRequestOptions {
  pub url: String,
  #[serde(default)]
  pub method: String,
  #[serde(default)]
  pub timeout: Option<u64>,
  #[serde(default)]
  pub headers: std::collections::HashMap<String, String>,
  #[serde(default)]
  pub body: Option<String>,
  #[serde(default)]
  pub form: Option<std::collections::HashMap<String, String>>,
  #[serde(default)]
  pub response_type: Option<String>,
  #[serde(default)]
  pub encoding: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LxResponse {
  pub status_code: u16,
  pub headers: std::collections::HashMap<String, String>,
  pub body: String,
  pub raw: Option<String>,
}

fn decode_body(bytes: &[u8], encoding: Option<&str>) -> String {
  if let Some(label) = encoding {
    if let Some(enc) = Encoding::for_label(label.as_bytes()) {
      let (text, _, _) = enc.decode(bytes);
      return text.into_owned();
    }
  }
  match std::str::from_utf8(bytes) {
    Ok(s) => s.to_string(),
    Err(_) => {
      let (text, _, _) = GBK.decode(bytes);
      if text.chars().any(|c| c != '\u{FFFD}') {
        return text.into_owned();
      }
      let (text, _, _) = UTF_8.decode(bytes);
      text.into_owned()
    }
  }
}

#[tauri::command]
pub async fn lx_request(
  options: LxRequestOptions,
) -> Result<LxResponse, String> {
  let method = if options.method.is_empty() {
    "GET"
  } else {
    options.method.as_str()
  };
  let timeout_ms = options.timeout.unwrap_or(15000).min(60000);

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_millis(timeout_ms))
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    .build()
    .map_err(|e| e.to_string())?;

  let mut req = client.request(
    reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
      .map_err(|e| format!("Invalid method {}: {}", method, e))?,
    &options.url,
  );

  for (k, v) in &options.headers {
    req = req.header(k, v);
  }

  if let Some(form) = &options.form {
    req = req.form(form);
  } else if let Some(body) = &options.body {
    req = req.body(body.clone());
  }

  let resp = req.send().await.map_err(|e| e.to_string())?;

  let status_code = resp.status().as_u16();
  let headers: std::collections::HashMap<String, String> = resp
    .headers()
    .iter()
    .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or_default().to_string()))
    .collect();

  let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

  let is_buffer = options.response_type.as_deref() == Some("buffer");
  if is_buffer {
    let raw = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(LxResponse {
      status_code,
      headers,
      body: String::new(),
      raw: Some(raw),
    })
  } else {
    let body = decode_body(&bytes, options.encoding.as_deref());
    Ok(LxResponse {
      status_code,
      headers,
      body,
      raw: None,
    })
  }
}
