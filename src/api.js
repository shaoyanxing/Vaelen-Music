import { invoke } from '@tauri-apps/api/core'
import LxRuntime from './runtime/lx-runtime'
import { builtinSearch, builtinSongLists, builtinSongList, builtinLeaderboards, builtinLeaderboard, isBuiltinSource } from './music-sdk/index.js'
import { builtinGetMusicUrl, builtinGetLyric, builtinGetPic } from './music-sdk/playback.js'

const hasTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const runtime = new LxRuntime()

// 把用户输入/粘贴的链接规整为可下载的 .js 直链候选列表：
// - 去掉 #fragment（如 GitHub 的 #L70）
// - github.com/xxx/blob/... 或 /raw/... → raw.githubusercontent.com 直链
// - 同时生成 jsdelivr 镜像作为备用（raw.githubusercontent 在国内常被屏蔽）
function importUrlCandidates(input) {
  let url = String(input || '').trim()
  const hash = url.indexOf('#')
  if (hash > -1) url = url.slice(0, hash)
  const m = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(blob|raw)\/([^/]+)\/(.+)$/)
  if (m) {
    const [, user, repo, , branch, path] = m
    // 先解码再编码：已 % 编码的段保持原样，未编码的中文/空格补上编码，避免二次编码（%25）
    const enc = path.split('/').map(seg => {
      let raw
      try { raw = decodeURIComponent(seg) } catch (_) { raw = seg }
      return encodeURIComponent(raw)
    }).join('/')
    return [
      `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${enc}`,
      `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${enc}`,
    ]
  }
  return [url]
}

// 下载到的是网页（HTML）而非脚本 → 明确提示
function looksLikeHtml(text) {
  const head = String(text || '').trim().slice(0, 500).toLowerCase()
  return /^<!doctype\s+html|<html|<head|<script\b|\?xml/.test(head)
}

// 分层设计：搜索 / 歌单 / 排行榜由内置官方接口（src/music-sdk/，与 server 端
// builtin-sdk.cjs 一致）直接提供，不依赖第三方脚本；播放 URL / 歌词 / 封面
// 同样内置优先，失败时回退到用户导入的 lx-music 脚本（社区脚本的破解源可
// 覆盖内置接口拿不到的 VIP / 无版权资源）。

export const api = {
  async loadSources() {
    let list = await runtime.getSourceList()
    if (hasTauri()) {
      try {
        const userApis = await invoke('user_api_get_all')
        for (const [info, script] of userApis) {
          try { await runtime.loadSource(script) }
          catch (err) { console.error('[Source] Failed to load user api ' + info.name + ':', err.message) }
        }
        list = await runtime.getSourceList()
      } catch (err) { console.error('Failed to load user apis:', err) }
    }
    return list
  },

  async importSource(scriptContent) {
    if (hasTauri()) {
      await invoke('user_api_import', { scriptContent })
      return this.loadSources()
    }
    const res = await fetch('/api/sources/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptContent })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '导入失败')
    return data.sources
  },

  async importSourceFromUrl(rawUrl) {
    const urls = importUrlCandidates(rawUrl)
    let lastErr = null
    for (const url of urls) {
      try {
        const scriptContent = await this.fetchScriptText(url)
        if (looksLikeHtml(scriptContent)) {
          lastErr = new Error('下载到的是网页而非 .js 文件，请使用 raw 直链（github 页面点击 Raw 按钮复制链接）')
          continue
        }
        if (!scriptContent || !scriptContent.trim()) {
          lastErr = new Error('网址内容为空')
          continue
        }
        return await this.importSource(scriptContent)
      } catch (err) {
        lastErr = err
      }
    }
    const raw = (lastErr && lastErr.message) ? lastErr.message : String(lastErr || '未知错误')
    let hint = ''
    if (/timed? ?out|timeout|超时/i.test(raw)) hint = '（请求超时，请确认网址可访问）'
    else if (/dns|resolve|connection|refused|tls|certificate|ssl/i.test(raw)) hint = '（网络无法连接，可换 jsdelivr 镜像或直接下载 .js 文件用本地导入）'
    else if (/http request/i.test(raw)) hint = '（注意：仅支持 https:// 直链）'
    throw new Error('下载脚本失败：' + raw + hint)
  },

  async fetchScriptText(url) {
    if (hasTauri()) {
      const res = await invoke('lx_request', {
        options: {
          url,
          method: 'GET',
          timeout: 20000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        },
      })
      if (res && res.status_code >= 400) throw new Error('HTTP ' + res.status_code)
      return res && res.body
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.text()
    } finally {
      clearTimeout(timer)
    }
  },

  async removeSource(sourceId) {
    if (hasTauri()) {
      try { await invoke('user_api_remove', { ids: [sourceId] }) } catch {}
    }
    // 浏览器模式下，runtime 没有 remove 概念；用户刷新页面即重置
    return this.loadSources()
  },

  async search(sourceId, keyword, page) {
    if (hasTauri()) {
      // 内置源优先（与 server /api/search 一致的原始实现：官方接口直搜，不依赖脚本）
      if (isBuiltinSource(sourceId)) {
        try { return await builtinSearch(sourceId, keyword, page || 1) }
        catch (e) { console.warn(`[builtin ${sourceId} search] 失败，回退到 runtime:`, e.message) }
      }
      return runtime.search(sourceId, keyword, page || 1)
    }
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, keyword, page: page || 1 })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '搜索失败')
    return data.data
  },

  async songLists(sourceId, type = 'all', page = 1, limit = 30) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try { return await builtinSongLists(sourceId, type, page, limit) }
        catch (e) { console.warn(`[builtin ${sourceId} songLists] 失败，回退到 runtime:`, e.message) }
      }
      return runtime.songLists(sourceId, type, page, limit)
    }
    const res = await fetch(`/api/songlists?source=${sourceId}&type=${encodeURIComponent(type)}&page=${page}&limit=${limit}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取歌单失败')
    return data.data
  },

  async songList(sourceId, id, page = 1, limit = 50) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try { return await builtinSongList(sourceId, id, page, limit) }
        catch (e) { console.warn(`[builtin ${sourceId} songList] 失败，回退到 runtime:`, e.message) }
      }
      return runtime.songList(sourceId, id, page, limit)
    }
    const res = await fetch(`/api/songlist?source=${sourceId}&id=${encodeURIComponent(id)}&page=${page}&limit=${limit}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取歌单详情失败')
    return data.data
  },

  async leaderboards(sourceId) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try { return await builtinLeaderboards(sourceId) }
        catch (e) { console.warn(`[builtin ${sourceId} leaderboards] 失败，回退到 runtime:`, e.message) }
      }
      return runtime.leaderboards(sourceId)
    }
    const res = await fetch(`/api/leaderboards?source=${sourceId}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取排行榜失败')
    return data.data
  },

  async leaderboard(sourceId, id, page = 1, limit = 100) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try { return await builtinLeaderboard(sourceId, id, page, limit) }
        catch (e) { console.warn(`[builtin ${sourceId} leaderboard] 失败，回退到 runtime:`, e.message) }
      }
      return runtime.leaderboard(sourceId, id, page, limit)
    }
    const res = await fetch(`/api/leaderboard?source=${sourceId}&id=${encodeURIComponent(id)}&page=${page}&limit=${limit}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取榜单详情失败')
    return data.data
  },

  async musicUrl(sourceId, musicInfo, quality) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try {
          const url = await builtinGetMusicUrl(sourceId, musicInfo, quality)
          if (url) return url
        } catch (e) {
          console.warn(`[builtin ${sourceId} musicUrl] 失败，回退到 runtime:`, e.message)
        }
      }
      return runtime.getMusicUrl(sourceId, musicInfo, quality)
    }
    const res = await fetch('/api/music-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, musicInfo, quality })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取链接失败')
    return data.url
  },

  async lyric(sourceId, musicInfo) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try {
          const data = await builtinGetLyric(sourceId, musicInfo)
          if (data) return data
        } catch (e) { console.warn(`[builtin ${sourceId} lyric] 失败:`, e.message) }
      }
      try { return await runtime.getLyric(sourceId, musicInfo) } catch (e) { }
    }
    const res = await fetch('/api/lyric', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, musicInfo })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取歌词失败')
    return data.data
  },

  async pic(sourceId, musicInfo) {
    if (hasTauri()) {
      if (isBuiltinSource(sourceId)) {
        try {
          const url = await builtinGetPic(sourceId, musicInfo)
          if (url) return url
        } catch (e) { /* 静默 */ }
      }
      try { return await runtime.getPic(sourceId, musicInfo) } catch (e) { }
    }
    const res = await fetch('/api/pic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, musicInfo })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '获取封面失败')
    return data.url
  },
}

const triggerDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'music.mp3'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const downloadMusic = async (sourceId, musicInfo, quality, filename, url) => {
  const target = filename || (musicInfo.name || 'music') + (musicInfo.singer ? ' - ' + musicInfo.singer : '')
  if (hasTauri()) {
    // Tauri 桌面：弹系统保存对话框选择路径，Rust 流式下载
    const saved = await invoke('download_song', { url, filename: target })
    if (saved === '__cancelled__') throw new Error('DOWNLOAD_CANCELLED')
    return saved
  }
  const realUrl = url || await api.musicUrl(sourceId, musicInfo, quality)
  // Web 模式：优先 fetch→blob，失败回退到同源服务端代理
  try {
    const res = await fetch(realUrl)
    if (res.ok) {
      const blob = await res.blob()
      triggerDownload(URL.createObjectURL(blob), target)
      return null
    }
  } catch (_) { /* 直链 fetch 失败（CORS），回退到代理 */ }
  triggerDownload(`/api/download?url=${encodeURIComponent(realUrl)}&filename=${encodeURIComponent(target)}`, target)
  return null
}

export { runtime, hasTauri }
