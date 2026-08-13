const https = require('https');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 与 lx-music-desktop src/main/modules/userApi/renderer/preload.js 对齐的沙箱契约：
// - send/on 返回 Promise，脚本可 await
// - request: body/form/formData、超时上限 60s、自动 JSON 解析、raw 为 base64
// - musicUrl/lyric/pic 结果强校验
// - utils.crypto.aesEncrypt/rsaEncrypt/randomBytes 均为 Buffer 语义

const clampTimeout = t => {
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return 60000;
  return Math.min(n, 60000);
};

const parseScriptInfo = scriptContent => {
  const info = { name: '', version: '', author: '', description: '' };
  const m = String(scriptContent || '').match(/\/\*!?([\s\S]*?)\*\//);
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/@(name|version|author|description)\s+(.*)/);
      if (kv) info[kv[1]] = kv[2].trim();
    }
  }
  return info;
};

class LxRuntime {
  constructor() {
    // sources: Map<sourceId, cfg>（首个注册脚本的配置生效）
    // handlers: Map<sourceId, Array<{cfg, handler}>>（按加载顺序回退）
    this.sources = new Map();
    this.handlers = new Map();
  }

  async loadSource(scriptContent, meta = {}) {
    let requestHandler = null;
    let initData = null;
    const waiters = [];

    function lxRequest(url, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      options = options || {};
      const timeout = clampTimeout(options.timeout);
      const method = (options.method || 'GET').toUpperCase();
      const headers = Object.assign({}, options.headers || {});
      const responseType = options.responseType || 'text';

      if (!headers['User-Agent']) headers['User-Agent'] = DEFAULT_UA;
      if (headers['Accept-Encoding'] !== '' && !headers['Accept-Encoding']) {
        headers['Accept-Encoding'] = 'gzip, deflate, br';
      }

      let body;
      if (options.body !== undefined && options.body !== null) {
        body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        if (!headers['Content-Type'] && typeof options.body !== 'string') headers['Content-Type'] = 'application/json';
      } else if (options.form) {
        body = new URLSearchParams(options.form).toString();
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (options.formData) {
        // 服务端沙箱不支持 multipart formData
        const err = new Error('formData is not supported in this environment');
        if (callback) { callback(err); return null; }
        return Promise.reject(err);
      }

      const promise = callback ? null : new Promise((resolve, reject) => {
        callback = (err, res) => err ? reject(err) : resolve(res);
      });

      const parsedUrl = new URL(url);
      const proto = parsedUrl.protocol === 'https:' ? https : http;
      let aborted = false;

      const req = proto.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
        timeout,
      }, (res) => {
        if (aborted) return;
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          if (aborted) return;
          let raw = Buffer.concat(chunks);
          const encoding = (res.headers['content-encoding'] || '').trim().toLowerCase();
          try {
            if (encoding.includes('gzip')) raw = zlib.gunzipSync(raw);
            else if (encoding.includes('deflate')) raw = zlib.inflateSync(raw);
            else if (encoding.includes('br')) raw = zlib.brotliDecompressSync(raw);
          } catch (e) { /* keep raw */ }

          const resHeaders = {};
          for (const [k, v] of Object.entries(res.headers)) resHeaders[k] = v;

          let bodyOut = '';
          if (responseType !== 'buffer') {
            bodyOut = raw.toString('utf8');
            try { bodyOut = JSON.parse(bodyOut); } catch (_) { /* keep string */ }
          }

          const result = {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage || '',
            headers: resHeaders,
            header: resHeaders,
            bytes: raw.length,
            raw: raw.toString('base64'),
            rawBody: raw,
            body: bodyOut,
          };
          callback(null, result);
        });
      });

      req.on('error', (err) => { if (!aborted) { aborted = true; callback(err); } });
      req.on('timeout', () => {
        if (aborted) return;
        aborted = true;
        req.destroy();
        callback(new Error('Request timeout'));
      });

      if (body !== undefined && body !== null) req.write(body);
      req.end();

      return promise;
    }

    const lxApi = {
      version: '2.1.0',
      env: 'desktop',
      currentScriptInfo: {
        name: meta.name || parseScriptInfo(scriptContent).name || 'Unknown Script',
        version: meta.version || parseScriptInfo(scriptContent).version || '',
        author: meta.author || parseScriptInfo(scriptContent).author || '',
        description: meta.description || parseScriptInfo(scriptContent).description || '',
      },
      EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
      on: (eventName, handler) => new Promise((resolve, reject) => {
        if (eventName === 'request') {
          requestHandler = handler;
          resolve();
        } else {
          reject(new Error('The event is not supported: ' + eventName));
        }
      }),
      send: (eventName, data) => new Promise((resolve, reject) => {
        if (eventName === 'inited') {
          if (initData) return reject(new Error('Script is inited'));
          initData = data;
          resolve();
          waiters.forEach(fn => fn());
        } else if (eventName === 'updateAlert') {
          // 忽略更新提示，仅确认
          resolve();
        } else {
          reject(new Error('The event is not supported: ' + eventName));
        }
      }),
      request: lxRequest,
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
          md5: (str) => crypto.createHash('md5').update(String(str)).digest('hex'),
          sha1: (str) => crypto.createHash('sha1').update(String(str)).digest('hex'),
          sha256: (str) => crypto.createHash('sha256').update(String(str)).digest('hex'),
          aesEncrypt: (data, mode, key, iv) => {
            const m = String(mode || 'aes-128-cbc').toLowerCase();
            try {
              const input = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
              const cipher = m.includes('ecb')
                ? crypto.createCipheriv(m, key, null)
                : crypto.createCipheriv(m, key, iv);
              return Buffer.concat([cipher.update(input), cipher.final()]);
            } catch (e) { return Buffer.alloc(0); }
          },
          aesDecrypt: (data, mode, key, iv) => {
            const m = String(mode || 'aes-128-cbc').toLowerCase();
            try {
              const input = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
              const decipher = m.includes('ecb')
                ? crypto.createDecipheriv(m, key, null)
                : crypto.createDecipheriv(m, key, iv);
              return Buffer.concat([decipher.update(input), decipher.final()]);
            } catch (e) { return Buffer.alloc(0); }
          },
          rsaEncrypt: (data, key) => {
            try {
              const input = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
              const padded = Buffer.concat([Buffer.alloc(128 - Math.min(input.length, 128)), input]);
              return crypto.publicEncrypt({ key, padding: crypto.constants.RSA_NO_PADDING }, padded);
            } catch (e) { return Buffer.alloc(0); }
          },
          rsaDecrypt: (data, key) => {
            try {
              const input = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'base64');
              return crypto.privateDecrypt({ key, padding: crypto.constants.RSA_NO_PADDING }, input);
            } catch (e) { return Buffer.alloc(0); }
          },
          randomBytes: (size) => crypto.randomBytes(size),
          base64Encode: (str) => Buffer.from(String(str), 'utf8').toString('base64'),
          base64Decode: (str) => Buffer.from(String(str), 'base64').toString('utf8'),
        },
        buffer: {
          from: (data, encoding) => Buffer.from(data, encoding),
          bufToString: (buf, format) => Buffer.from(buf, 'binary').toString(format || 'utf8'),
          concat: (bufs) => Buffer.concat(bufs),
        },
        zlib: {
          inflate: (data) => new Promise((resolve, reject) => {
            zlib.inflate(Buffer.from(data), (err, buf) => err ? reject(new Error(err.message)) : resolve(buf));
          }),
          deflate: (data) => new Promise((resolve, reject) => {
            zlib.deflate(Buffer.from(data), (err, buf) => err ? reject(new Error(err.message)) : resolve(buf));
          }),
          inflateRaw: (data) => new Promise((resolve, reject) => {
            zlib.inflateRaw(Buffer.from(data), (err, buf) => err ? reject(new Error(err.message)) : resolve(buf));
          }),
          deflateRaw: (data) => new Promise((resolve, reject) => {
            zlib.deflateRaw(Buffer.from(data), (err, buf) => err ? reject(new Error(err.message)) : resolve(buf));
          }),
        },
      },
    };

    const scriptFn = new Function(
      'globalThis', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'Buffer', 'JSON', 'Math', 'Date', 'Map', 'Set', 'Promise', 'Array',
      'Object', 'String', 'Number', 'RegExp', 'Error', 'TypeError', 'URL',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
      'encodeURIComponent', 'decodeURIComponent', 'atob', 'btoa',
      'require', 'process', 'module', 'exports', '__filename', '__dirname',
      'queueMicrotask', 'performance',
      scriptContent
    );

    const sandboxGlobal = { lx: lxApi };
    sandboxGlobal.globalThis = sandboxGlobal;
    sandboxGlobal.window = sandboxGlobal;
    sandboxGlobal.global = sandboxGlobal;
    sandboxGlobal.self = sandboxGlobal;
    sandboxGlobal.process = process;
    sandboxGlobal.require = require;
    sandboxGlobal.module = { exports: {} };
    sandboxGlobal.exports = sandboxGlobal.module.exports;

    scriptFn(
      sandboxGlobal, console, setTimeout, clearTimeout, setInterval, clearInterval,
      Buffer, JSON, Math, Date, Map, Set, Promise, Array, Object, String,
      Number, RegExp, Error, TypeError, URL,
      parseInt, parseFloat, isNaN, isFinite, encodeURI, decodeURI,
      encodeURIComponent, decodeURIComponent,
      (str) => Buffer.from(str, 'base64').toString('utf8'),
      (str) => Buffer.from(str, 'utf8').toString('base64'),
      require, process, sandboxGlobal.module, sandboxGlobal.module.exports,
      __filename, __dirname,
      queueMicrotask, performance
    );

    // 等待脚本 send(EVENT_NAMES.inited, ...)（允许异步初始化，最多等 8s）
    if (!initData) {
      try {
        await Promise.race([
          new Promise(resolve => waiters.push(resolve)),
          new Promise(resolve => setTimeout(resolve, 8000)),
        ]);
      } catch (e) { /* ignore */ }
    }

    if (initData && initData.sources) {
      for (const [key, cfg] of Object.entries(initData.sources)) {
        if (!cfg || cfg.type !== 'music') continue;
        if (!this.sources.has(key)) this.sources.set(key, Object.assign({}, cfg));
        const list = this.handlers.get(key) || [];
        list.push({ cfg, handler: requestHandler });
        this.handlers.set(key, list);
      }
    } else {
      throw new Error('初始化超时或脚本未调用 lx.send("inited")');
    }
    return initData;
  }

  async getSourceList() {
    const list = [];
    for (const [key, cfg] of this.sources) {
      list.push({ id: key, name: cfg.name, type: cfg.type, actions: cfg.actions, qualitys: cfg.qualitys });
    }
    return list;
  }

  resolveAction(wanted, declared) {
    if (declared && declared.includes(wanted)) return wanted;
    if (wanted === 'musicSearch') {
      const alias = (['musicSearch', 'search']).find(a => declared && declared.includes(a));
      if (alias) return alias;
    }
    return wanted;
  }

  validateResult(action, result) {
    switch (action) {
      case 'musicSearch':
        if (Array.isArray(result)) return { list: result, total: result.length, isEnd: true };
        if (result && typeof result === 'object' && Array.isArray(result.list)) {
          return { ...result, total: result.total ?? result.list.length, isEnd: result.isEnd !== false };
        }
        throw new Error('搜索返回格式错误');
      case 'musicUrl':
        if (typeof result === 'string' && result.length <= 2048 && /^https?:/.test(result)) return result;
        throw new Error('无效的播放地址');
      case 'lyric':
        if (!result || typeof result !== 'object' || typeof result.lyric !== 'string' || result.lyric.length > 51200) {
          throw new Error('无效的歌词数据');
        }
        return {
          lyric: result.lyric,
          tlyric: (typeof result.tlyric === 'string' && result.tlyric.length < 5120) ? result.tlyric : null,
          rlyric: (typeof result.rlyric === 'string' && result.rlyric.length < 5120) ? result.rlyric : null,
          lxlyric: (typeof result.lxlyric === 'string' && result.lxlyric.length < 8192) ? result.lxlyric : null,
        };
      case 'pic':
        if (result == null) return null;
        if (typeof result === 'string' && result.length <= 2048 && /^https?:/.test(result)) return result;
        throw new Error('无效的封面地址');
      default:
        return result;
    }
  }

  async request(sourceId, action, info) {
    const list = this.handlers.get(sourceId);
    if (!list || !list.length) throw new Error('Source ' + sourceId + ' not found');

    let lastErr = null;
    for (const entry of list) {
      if (!entry.handler) continue;
      try {
        const finalAction = this.resolveAction(action, entry.cfg && entry.cfg.actions);
        const result = await entry.handler({ source: sourceId, action: finalAction, info });
        if (result === undefined || result === null) throw new Error('该音源未返回结果');
        return this.validateResult(action, result);
      } catch (err) {
        lastErr = err;
      }
    }

    if (action === 'pic') return null;
    const reason = (lastErr && (lastErr.message || String(lastErr))) || '未知错误';
    if (/action not support|not support|不支持操作/.test(reason)) {
      throw new Error(`音源 ${sourceId} 未提供「${this.actionLabel(action)}」能力（该脚本只支持 ${Array.isArray(list[0] && list[0].cfg && list[0].cfg.actions) ? list[0].cfg.actions.join(', ') : '部分'} 功能），请换用支持「${this.actionLabel(action)}」的完整音源脚本`);
    }
    throw lastErr || new Error(`音源 ${sourceId} 不支持操作: ${action}`);
  }

  actionLabel(action) {
    return ({
      musicSearch: '搜索', musicUrl: '播放地址', lyric: '歌词', pic: '封面',
      'musicSongList.getLists': '歌单列表', 'musicSongList.getList': '歌单详情',
      'musicLeaderboard.getLists': '排行榜', 'musicLeaderboard.getList': '榜单详情',
    }[action] || action);
  }

  async search(sourceId, keyword, page) { return this.request(sourceId, 'musicSearch', { keyword, page: page || 1, limit: 30 }); }
  async getMusicUrl(sourceId, musicInfo, quality) { return this.request(sourceId, 'musicUrl', { musicInfo, type: quality }); }
  async getLyric(sourceId, musicInfo) { return this.request(sourceId, 'lyric', { musicInfo }); }
  async getPic(sourceId, musicInfo) { return this.request(sourceId, 'pic', { musicInfo }); }

  // 歌单 / 排行榜（lx 脚本动作：musicSongList.getLists / getList、musicLeaderboard.getLists / getList）
  async songLists(sourceId, type = 'all', page = 1, limit = 30) {
    return this.request(sourceId, 'musicSongList.getLists', { type, page: page || 1, limit: limit || 30 });
  }
  async songList(sourceId, id, page = 1, limit = 50) {
    return this.request(sourceId, 'musicSongList.getList', { id, page: page || 1, limit: limit || 50 });
  }
  async leaderboards(sourceId) {
    return this.request(sourceId, 'musicLeaderboard.getLists', {});
  }
  async leaderboard(sourceId, id, page = 1, limit = 100) {
    return this.request(sourceId, 'musicLeaderboard.getList', { id, page: page || 1, limit: limit || 100 });
  }
}

module.exports = LxRuntime;