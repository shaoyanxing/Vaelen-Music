import { invoke } from '@tauri-apps/api/core'
import CJS from '../music-sdk/crypto-lib.js'

const hasTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const clampTimeout = t => {
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return 60000
  return Math.min(n, 60000)
}

const bytesToBase64 = bytes => {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

const base64ToBytes = b64 => {
  const bin = atob(String(b64))
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

const hexToBytes = hex => {
  const out = new Uint8Array(Math.floor(String(hex).length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

const bytesToHex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

const toUint8 = data => {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (typeof data === 'string') return new TextEncoder().encode(data)
  return new Uint8Array(0)
}

function lxRequestViaTauri(url, options) {
  // Tauri v2: Rust 命令签名为 lx_request(options: LxRequestOptions)，参数名必须为 options
  return invoke('lx_request', {
    options: {
      url,
      method: options.method || 'GET',
      timeout: clampTimeout(options.timeout),
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
    bytes: res.raw ? res.raw.length : undefined,
    body: res.body,
    raw: res.raw,
  }))
}

function decodeResponseBuffer(buf, encoding) {
  if (encoding) {
    try { return new TextDecoder(encoding).decode(buf) } catch (_) {}
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch (_) {}
  try { return new TextDecoder('gbk').decode(buf) } catch (_) {}
  return new TextDecoder('utf-8').decode(buf)
}

function lxRequestViaFetch(url, options) {
  const method = (options.method || 'GET').toUpperCase()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), clampTimeout(options.timeout))
  const headers = Object.assign({}, options.headers || {})
  const init = { method, headers, signal: controller.signal }
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
    const buf = new Uint8Array(await res.arrayBuffer())
    const headersObj = {}
    res.headers.forEach((v, k) => { headersObj[k] = v })
    const base = { statusCode: res.status, headers: headersObj, rawBody: buf }
    if (options.responseType === 'buffer') {
      return { ...base, body: '', raw: bytesToBase64(buf) }
    }
    let body = decodeResponseBuffer(buf, options.encoding)
    try { body = JSON.parse(body) } catch (_) {}
    return { ...base, body }
  }).finally(() => clearTimeout(timer))
}

const decompressStream = async (buf, format) => {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const compressStream = async (buf, format) => {
  const stream = new Blob([buf]).stream().pipeThrough(new CompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

class LxRuntime {
  constructor() {
    // sources: Map<sourceId, cfg>（首个注册脚本的配置生效）
    // sourceHandlers: Map<sourceId, Array<{cfg, handler}>>（按加载顺序回退）
    this.sources = new Map()
    this.sourceHandlers = new Map()
  }

  async loadSource(scriptContent) {
    const instance = { sources: new Map(), requestHandler: null, initCallback: null, initWaiters: [] }

    const request = (url, options, callback) => {
      if (typeof options === 'function') { callback = options; options = {} }
      options = options || {}
      const promise = callback ? null : new Promise((resolve, reject) => {
        callback = (err, res) => err ? reject(err) : resolve(res)
      })
      const p = hasTauri()
        ? lxRequestViaTauri(url, options)
        : lxRequestViaFetch(url, options)
      p.then(res => {
        if (options.responseType === 'buffer' && !res.rawBody) {
          let rawBytes = null
          if (res.raw) {
            try { rawBytes = base64ToBytes(res.raw) } catch (_) {}
          }
          callback(null, { ...res, rawBody: rawBytes })
        } else {
          callback(null, res)
        }
      }).catch(err => callback(err))
      return promise
    }

    const base64Encode = (str) => {
      try { return btoa(unescape(encodeURIComponent(String(str)))) } catch (_) { return btoa(String(str)) }
    }
    const base64Decode = (str) => {
      try { return decodeURIComponent(escape(atob(String(str)))) } catch (_) { return atob(String(str)) }
    }

    const aesConfig = (mode) => {
      const m = String(mode || 'aes-128-cbc').toLowerCase()
      const modeCfg = m.includes('ecb') ? CJS.mode.ECB : CJS.mode.CBC
      return { m, modeCfg }
    }

    const lxApi = {
      version: '2.1.0',
      env: 'desktop',
      currentScriptInfo: {
        name: 'Vaelen Music Script',
        version: '1.0.0',
        description: '',
        author: '',
      },
      EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
      on: (eventName, handler) => new Promise((resolve, reject) => {
        if (eventName === 'request') {
          instance.requestHandler = handler
          resolve()
        } else {
          reject(new Error('The event is not supported: ' + eventName))
        }
      }),
      send: (eventName, data) => new Promise((resolve, reject) => {
        if (eventName === 'inited') {
          if (instance.initCallback) return reject(new Error('Script is inited'))
          instance.initCallback = data
          resolve()
          instance.initWaiters.forEach(fn => fn())
        } else if (eventName === 'updateAlert') {
          resolve()
        } else {
          reject(new Error('The event is not supported: ' + eventName))
        }
      }),
      request,
      storage: {
        get: () => undefined,
        set: () => {},
        remove: () => {},
      },
      info: {
        version: '2.1.0',
        build: '1.0.0',
        platform: 'win32',
        arch: 'x64',
      },
      utils: {
        crypto: {
          md5: (str) => CJS.MD5(String(str)).toString(CJS.enc.Hex),
          sha1: (str) => CJS.SHA1(String(str)).toString(CJS.enc.Hex),
          sha256: (str) => CJS.SHA256(String(str)).toString(CJS.enc.Hex),
          aesEncrypt: (data, mode, key, iv) => {
            try {
              const { m, modeCfg } = aesConfig(mode)
              const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(toUint8(data))
              const keyWA = CJS.enc.Utf8.parse(String(key))
              const ivWA = m.includes('ecb') ? null : CJS.enc.Utf8.parse(String(iv))
              const enc = CJS.AES.encrypt(CJS.enc.Utf8.parse(text), keyWA, { iv: ivWA, mode: modeCfg })
              return hexToBytes(enc.ciphertext.toString(CJS.enc.Hex))
            } catch (_) { return new Uint8Array(0) }
          },
          aesDecrypt: (data, mode, key, iv) => {
            try {
              const { m, modeCfg } = aesConfig(mode)
              const keyWA = CJS.enc.Utf8.parse(String(key))
              const ivWA = m.includes('ecb') ? null : CJS.enc.Utf8.parse(String(iv))
              const hex = typeof data === 'string' ? data : bytesToHex(toUint8(data))
              const dec = CJS.AES.decrypt({ ciphertext: CJS.enc.Hex.parse(hex) }, keyWA, { iv: ivWA, mode: modeCfg })
              return new TextEncoder().encode(CJS.enc.Utf8.stringify(dec))
            } catch (_) { return new Uint8Array(0) }
          },
          rsaEncrypt: () => '',
          rsaDecrypt: () => '',
          randomBytes: (size) => {
            const arr = new Uint8Array(size)
            crypto.getRandomValues(arr)
            return arr
          },
          base64Encode,
          base64Decode,
        },
        buffer: {
          from: (data, encoding) => {
            if (data instanceof Uint8Array) return data
            if (encoding === 'base64') return base64ToBytes(String(data))
            return new TextEncoder().encode(String(data))
          },
          bufToString: (buf, format) => {
            if (format === 'base64') return bytesToBase64(toUint8(buf))
            return new TextDecoder(format || 'utf-8').decode(toUint8(buf))
          },
          concat: (bufs) => {
            let total = 0
            for (const b of bufs) total += b.length
            const out = new Uint8Array(total)
            let offset = 0
            for (const b of bufs) { out.set(b, offset); offset += b.length }
            return out
          },
        },
        zlib: {
          inflate: (data) => decompressStream(toUint8(data), 'deflate'),
          deflate: (data) => compressStream(toUint8(data), 'deflate'),
          inflateRaw: () => Promise.reject(new Error('inflateRaw not supported in webview')),
          deflateRaw: () => Promise.reject(new Error('deflateRaw not supported in webview')),
        },
      },
    }

    const sandboxGlobal = { lx: lxApi }
    sandboxGlobal.globalThis = sandboxGlobal
    sandboxGlobal.window = sandboxGlobal
    sandboxGlobal.global = sandboxGlobal
    sandboxGlobal.self = sandboxGlobal

    const scriptFn = new Function(
      'globalThis', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'JSON', 'Math', 'Date', 'Map', 'Set', 'Promise', 'Array',
      'Object', 'String', 'Number', 'RegExp', 'Error', 'TypeError', 'URL',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
      'encodeURIComponent', 'decodeURIComponent', 'atob', 'btoa',
      'queueMicrotask', 'performance', 'XMLHttpRequest', 'fetch', 'navigator',
      scriptContent
    )

    const safeGlobal = (name) => {
      try { return globalThis[name] } catch (_) { return undefined }
    }

    scriptFn(
      sandboxGlobal, console, setTimeout, clearTimeout, setInterval, clearInterval,
      JSON, Math, Date, Map, Set, Promise, Array, Object, String,
      Number, RegExp, Error, TypeError, URL,
      parseInt, parseFloat, isNaN, isFinite, encodeURI, decodeURI,
      encodeURIComponent, decodeURIComponent, atob, btoa,
      queueMicrotask, performance,
      safeGlobal('XMLHttpRequest'), safeGlobal('fetch'), safeGlobal('navigator')
    )

    // 等待脚本 send(EVENT_NAMES.inited, ...)（允许异步初始化，最多等 8s）
    if (!instance.initCallback) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 8000)
        instance.initWaiters.push(() => { clearTimeout(timer); resolve() })
      })
    }

    if (instance.initCallback && instance.initCallback.sources) {
      for (const [key, cfg] of Object.entries(instance.initCallback.sources)) {
        if (!cfg || cfg.type !== 'music') continue
        if (!this.sources.has(key)) this.sources.set(key, Object.assign({}, cfg))
        const list = this.sourceHandlers.get(key) || []
        list.push({ cfg, handler: instance.requestHandler })
        this.sourceHandlers.set(key, list)
      }
    } else {
      throw new Error('初始化超时或脚本未调用 lx.send("inited")')
    }
    return instance.initCallback
  }

  async getSourceList() {
    const list = []
    for (const [key, cfg] of this.sources) {
      list.push({ id: key, name: cfg.name, type: cfg.type, actions: cfg.actions, qualitys: cfg.qualitys })
    }
    return list
  }

  resolveAction(wanted, declared) {
    if (declared && declared.includes(wanted)) return wanted
    if (wanted === 'musicSearch') {
      const alias = (['musicSearch', 'search']).find(a => declared && declared.includes(a))
      if (alias) return alias
    }
    return wanted
  }

  validateResult(action, result) {
    switch (action) {
      case 'musicSearch':
        if (Array.isArray(result)) return { list: result, total: result.length, isEnd: true }
        if (result && typeof result === 'object' && Array.isArray(result.list)) {
          return { ...result, total: result.total ?? result.list.length, isEnd: result.isEnd !== false }
        }
        throw new Error('搜索返回格式错误')
      case 'musicUrl':
        if (typeof result === 'string' && result.length <= 2048 && /^https?:/.test(result)) return result
        throw new Error('无效的播放地址')
      case 'lyric':
        if (!result || typeof result !== 'object' || typeof result.lyric !== 'string' || result.lyric.length > 51200) {
          throw new Error('无效的歌词数据')
        }
        return {
          lyric: result.lyric,
          tlyric: (typeof result.tlyric === 'string' && result.tlyric.length < 5120) ? result.tlyric : null,
          rlyric: (typeof result.rlyric === 'string' && result.rlyric.length < 5120) ? result.rlyric : null,
          lxlyric: (typeof result.lxlyric === 'string' && result.lxlyric.length < 8192) ? result.lxlyric : null,
        }
      case 'pic':
        if (result == null) return null
        if (typeof result === 'string' && result.length <= 2048 && /^https?:/.test(result)) return result
        throw new Error('无效的封面地址')
      default:
        return result
    }
  }

  async request(sourceId, action, info) {
    const list = this.sourceHandlers.get(sourceId)
    if (!list || !list.length) throw new Error('Source ' + sourceId + ' not found')

    let lastErr = null
    for (const entry of list) {
      if (!entry.handler) continue
      try {
        const finalAction = this.resolveAction(action, entry.cfg && entry.cfg.actions)
        const result = await entry.handler({ source: sourceId, action: finalAction, info })
        if (result === undefined || result === null) throw new Error('该音源未返回结果')
        return this.validateResult(action, result)
      } catch (err) {
        lastErr = err
      }
    }

    if (action === 'pic') return null
    const reason = (lastErr && (lastErr.message || String(lastErr))) || '未知错误'
    if (/action not support|not support|不支持操作/.test(reason)) {
      const declared = list[0] && list[0].cfg && list[0].cfg.actions
      throw new Error(`音源 ${sourceId} 未提供「${this.actionLabel(action)}」能力（该脚本只支持 ${Array.isArray(declared) ? declared.join(', ') : '部分'} 功能），请换用支持「${this.actionLabel(action)}」的完整音源脚本`)
    }
    throw lastErr || new Error(`音源 ${sourceId} 不支持操作: ${action}`)
  }

  actionLabel(action) {
    return {
      musicSearch: '搜索', musicUrl: '播放地址', lyric: '歌词', pic: '封面',
      'musicSongList.getLists': '歌单列表', 'musicSongList.getList': '歌单详情',
      'musicLeaderboard.getLists': '排行榜', 'musicLeaderboard.getList': '榜单详情',
    }[action] || action
  }

  async search(sourceId, keyword, page) {
    return this.request(sourceId, 'musicSearch', { keyword, page: page || 1, limit: 30 })
  }
  async getMusicUrl(sourceId, musicInfo, quality) { return this.request(sourceId, 'musicUrl', { musicInfo, type: quality }) }
  async getLyric(sourceId, musicInfo) { return this.request(sourceId, 'lyric', { musicInfo }) }
  async getPic(sourceId, musicInfo) { return this.request(sourceId, 'pic', { musicInfo }) }

  // 歌单 / 排行榜（lx 脚本动作：musicSongList.getLists / getList、musicLeaderboard.getLists / getList）
  async songLists(sourceId, type = 'all', page = 1, limit = 30) {
    return this.request(sourceId, 'musicSongList.getLists', { type, page: page || 1, limit: limit || 30 })
  }
  async songList(sourceId, id, page = 1, limit = 50) {
    return this.request(sourceId, 'musicSongList.getList', { id, page: page || 1, limit: limit || 50 })
  }
  async leaderboards(sourceId) {
    return this.request(sourceId, 'musicLeaderboard.getLists', {})
  }
  async leaderboard(sourceId, id, page = 1, limit = 100) {
    return this.request(sourceId, 'musicLeaderboard.getList', { id, page: page || 1, limit: limit || 100 })
  }
}

export default LxRuntime