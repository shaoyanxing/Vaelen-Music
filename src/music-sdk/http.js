import { invoke } from '@tauri-apps/api/core'

const hasTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function lxRequestViaTauri(url, options = {}) {
  // Tauri v2: Rust 签名 `fn lx_request(options: LxRequestOptions)`，
  // invoke 参数必须包在 `{ options: {...} }` 里，传参名匹配 Rust 参数名
  return invoke('lx_request', {
    options: {
      url,
      method: options.method || 'GET',
      timeout: options.timeout || 20000,
      headers: options.headers || {},
      body: options.body ?? null,
      form: options.form ?? null,
      response_type: options.responseType || 'text',
      encoding: options.encoding ?? null,
    },
  }).then(res => ({
    statusCode: res.status_code,
    statusMessage: res.status_message || '',
    headers: res.headers || {},
    body: decodeBody(res.body),
    raw: res.raw,
  }))
}

function lxRequestViaFetch(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout || 20000)
  const headers = options.headers || {}
  const init = {
    method: (options.method || 'GET').toUpperCase(),
    headers,
    signal: controller.signal,
  }
  if (options.body !== undefined && options.body !== null) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    if (typeof options.body !== 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  } else if (options.form) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(options.form)) params.append(k, String(v))
    init.body = params.toString()
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }
  return fetch(url, init).then(async res => {
    let body = await res.text()
    body = decodeBody(body)
    const resHeaders = {}
    res.headers.forEach((v, k) => { resHeaders[k] = v })
    return { statusCode: res.status, headers: resHeaders, body }
  }).finally(() => clearTimeout(timer))
}

const decodeBody = str => {
  try { return JSON.parse(str) } catch (_) { return str }
}

export const lxRequest = (url, options = {}) => {
  if (hasTauri()) return lxRequestViaTauri(url, options)
  return lxRequestViaFetch(url, options)
}

const autoHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export const httpGet = (url, headers = {}) =>
  lxRequest(url, { method: 'GET', headers: { ...autoHeaders, ...headers } }).then(res => res.body)

export const httpPostForm = (url, form, headers = {}) =>
  lxRequest(url, {
    method: 'POST',
    form,
    headers: { ...autoHeaders, ...headers },
  }).then(res => res.body)

export const httpPostJson = (url, body, headers = {}) =>
  lxRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      ...autoHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  }).then(res => res.body)