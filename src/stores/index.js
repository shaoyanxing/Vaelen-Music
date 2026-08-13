import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { api, downloadMusic } from '../api'

export const usePlayerStore = defineStore('player', () => {
  const QUALITY_ORDER = ['master', 'hires', 'flac24bit', 'flac', '320k', '128k']
  const QUALITY_LABELS = {
    '128k': '128K', '320k': '320K', flac: 'FLAC', flac24bit: '24Bit', hires: 'Hi-Res', master: 'Master',
  }
  const playlist = ref([])
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.8)
  const quality = ref('128k')
  const currentUrl = ref('')
  const lyrics = ref(null)
  const playMode = ref('list') // list | shuffle | repeat
  const playError = ref('')
  const fullscreen = ref(false) // 全屏播放页显隐（替代旧版歌词弹窗）

  const currentSong = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
      return playlist.value[currentIndex.value]
    }
    return null
  })

  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < playlist.value.length - 1)

  let urlFetchSeq = 0

  function setPlaylist(songs) {
    playlist.value = songs
  }

  function playSong(index) {
    if (index < 0 || index >= playlist.value.length) return
    currentIndex.value = index
    currentUrl.value = ''
    duration.value = 0
    playError.value = ''
    fetchMusicUrl()
    fetchLyrics()
  }

  async function fetchMusicUrl() {
    const song = currentSong.value
    if (!song) return
    const seq = ++urlFetchSeq
    // 客户端超时：12s 后无论服务端是否返回都视为失败
    const timeoutMs = 12000
    // 从当前音质起，逐档降级尝试（master → hires → flac24bit → flac → 320k → 128k）
    const wanted = quality.value
    let startIdx = QUALITY_ORDER.indexOf(wanted)
    if (startIdx < 0) startIdx = QUALITY_ORDER.length - 1
    let lastErr = null
    for (let i = startIdx; i < QUALITY_ORDER.length; i++) {
      const q = QUALITY_ORDER[i]
      let timeoutId
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('获取播放地址超时（12s），请稍后重试')), timeoutMs)
      })
      try {
        const url = await Promise.race([
          api.musicUrl(song.source || 'wy', song, q),
          timeoutPromise,
        ])
        clearTimeout(timeoutId)
        if (seq !== urlFetchSeq) return
        if (url) {
          currentUrl.value = url
          isPlaying.value = true
          if (q !== wanted) {
            // 自动降级：同步音质设置，避免下一首重复白试高音质
            quality.value = q
            playError.value = `当前音源无「${QUALITY_LABELS[wanted] || wanted}」音质，已自动降级为「${QUALITY_LABELS[q] || q}」`
          }
          return
        }
        lastErr = new Error('返回的播放地址为空')
      } catch (e) {
        clearTimeout(timeoutId)
        if (seq !== urlFetchSeq) return
        lastErr = e
      }
    }
    // 所有档位都失败
    currentUrl.value = ''
    isPlaying.value = false
    // 友好错误：避免暴露"VIP/付费"等技术细节
    const msg = String(lastErr?.message || lastErr || '')
    if (msg.includes('超时')) {
      playError.value = '获取播放地址超时，请稍后重试或切换音源'
    } else if (msg.includes('404') || msg.includes('失效')) {
      playError.value = '该歌曲无法播放（链接失效或版权限制）'
    } else {
      playError.value = '该歌曲无法播放，请尝试其他版本或音源'
    }
    console.error('Failed to fetch music URL:', lastErr)
  }

  // audio 加载失败（URL 拿到了但播不了，如链接失效/无此音质）→ 降一档重试
  function handleAudioError() {
    if (!currentUrl.value) return
    currentUrl.value = ''
    const idx = QUALITY_ORDER.indexOf(quality.value)
    if (idx >= 0 && idx < QUALITY_ORDER.length - 1) {
      const failed = QUALITY_ORDER[idx]
      const next = QUALITY_ORDER[idx + 1]
      quality.value = next
      playError.value = `当前音源无「${QUALITY_LABELS[failed] || failed}」音质，已自动降级为「${QUALITY_LABELS[next] || next}」`
      fetchMusicUrl()
    } else {
      playError.value = '播放出错：音频文件无法加载，可能是链接已失效或已过期'
    }
  }

  async function fetchLyrics() {
    const song = currentSong.value
    if (!song) return
    let lyric = null
    try {
      const data = await api.lyric(song.source || 'wy', song)
      if (data && data.lyric && data.lyric.trim()) lyric = data
    } catch (e) {
      // 本源无歌词/失败 → 走跨源兜底
    }
    if (!lyric) {
      lyric = await fetchLyricFallback(song)
    }
    lyrics.value = lyric
  }

  // 本源没有歌词时，从其他音源搜索同名歌曲取歌词
  const FALLBACK_BUILTIN_SOURCES = ['kw', 'kg', 'wy', 'tx', 'mg']

  const normSongName = s => String(s.name || '')
    .toLowerCase()
    .replace(/[\u3000\s]/g, '')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[-—_].*$/, '')

  function pickBestMatch(list, song) {
    if (!Array.isArray(list) || !list.length) return null
    const target = normSongName(song)
    if (target) {
      const exact = list.find(i => normSongName(i) === target)
      if (exact) return exact
    }
    return list[0]
  }

  async function fetchLyricFallback(song) {
    const originSource = song.source || 'wy'
    const keyword = [song.name, song.singer].filter(Boolean).join(' ').trim()
    if (!keyword) return null
    let fallbackSources = []
    try {
      const sources = useAppStore().sources
      fallbackSources = sources.map(s => s.id).filter(id => id !== originSource)
    } catch (e) { /* 无 app store（Web 预热阶段） */ }
    if (!fallbackSources.length) {
      fallbackSources = FALLBACK_BUILTIN_SOURCES.filter(id => id !== originSource)
    }
    // 1) 并发搜索各源，取歌名匹配度最高的候选
    const searchRes = await Promise.allSettled(
      fallbackSources.map(sid =>
        api.search(sid, keyword, 1).then(d => ({ sid, item: pickBestMatch((d && d.list) || [], song) }))
      )
    )
    const candidates = searchRes
      .filter(r => r.status === 'fulfilled' && r.value && r.value.item)
      .map(r => r.value)
    // 2) 并发取歌词，第一个非空即用
    const lyricRes = await Promise.allSettled(candidates.map(c => api.lyric(c.sid, c.item)))
    for (const r of lyricRes) {
      if (r.status === 'fulfilled' && r.value && r.value.lyric && r.value.lyric.trim()) {
        return r.value
      }
    }
    return null
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function playNext() {
    if (hasNext.value) {
      playSong(currentIndex.value + 1)
    }
  }

  function playPrev() {
    if (hasPrev.value) {
      playSong(currentIndex.value - 1)
    }
  }

  function cyclePlayMode() {
    const order = ['list', 'shuffle', 'repeat']
    const i = order.indexOf(playMode.value)
    playMode.value = order[(i + 1) % order.length]
  }

  function pickNextIndex() {
    const len = playlist.value.length
    if (!len) return -1
    if (playMode.value === 'repeat') return currentIndex.value
    if (playMode.value === 'shuffle') {
      if (len === 1) return currentIndex.value
      let idx
      do {
        idx = Math.floor(Math.random() * len)
      } while (idx === currentIndex.value)
      return idx
    }
    return (currentIndex.value + 1) % len
  }

  // 自动切下一首（歌曲结束 / 播放失败跳转），按播放模式处理
  function nextAuto() {
    const idx = pickNextIndex()
    if (idx < 0) return
    playSong(idx)
  }

  function setQuality(q) {
    quality.value = q
    if (currentSong.value) fetchMusicUrl()
  }

  function setVolume(v) {
    volume.value = v
  }

  function setCurrentTime(t) {
    currentTime.value = t
  }

  function setDuration(d) {
    duration.value = d
  }

  function addToPlaylist(song) {
    playlist.value.push(song)
  }

  function removeFromPlaylist(index) {
    playlist.value.splice(index, 1)
    if (currentIndex.value >= playlist.value.length) {
      currentIndex.value = playlist.value.length - 1
    }
  }

  function clearPlaylist() {
    playlist.value = []
    currentIndex.value = -1
    isPlaying.value = false
    currentUrl.value = ''
    playError.value = ''
  }

  return {
    playlist, currentIndex, isPlaying, currentTime, duration, volume,
    quality, currentUrl, lyrics, playMode, playError, fullscreen, currentSong, hasPrev, hasNext,
    setPlaylist, playSong, togglePlay, playNext, playPrev, cyclePlayMode, nextAuto, setQuality,
    setVolume, setCurrentTime, setDuration, addToPlaylist, removeFromPlaylist,
    clearPlaylist, fetchMusicUrl, fetchLyrics, handleAudioError
  }
})

export const useAppStore = defineStore('app', () => {
  const playerStore = usePlayerStore()
  const sources = ref([])
  const activeSource = ref('')
  const searchResults = ref([])
  const searchKeyword = ref('')
  const isLoading = ref(false)
  const searchError = ref('')
  const searchPage = ref(1)
  const searchTotal = ref(0)
  const searchAllPage = ref(0)
  const searchLimit = ref(30)
  const sourceError = ref('')
  const userLists = ref([
    { id: 'default', name: '默认列表', songs: [] },
    { id: 'favorites', name: '收藏', songs: [] }
  ])
  const downloads = ref([])

  // ============ 持久化（列表 / 下载记录） ============
  // Tauri：写入 %APPDATA%\com.vaelen.music\settings.json
  // Web：localStorage 'vaelen-data'
  const hasTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

  async function readPersisted() {
    try {
      if (hasTauri()) return await invoke('settings_get')
      return JSON.parse(localStorage.getItem('vaelen-data') || '{}')
    } catch (_) { return {} }
  }

  let saveTimer = null
  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 400)
  }

  async function saveNow() {
    try {
      const payload = {
        userLists: userLists.value,
        downloads: downloads.value.map(d => {
          const { progress, status, ...rest } = d  // 进度/状态不持久化
          return rest
        }),
      }
      if (hasTauri()) {
        await invoke('settings_set', { key: 'data', value: payload })
      } else {
        localStorage.setItem('vaelen-data', JSON.stringify(payload))
      }
    } catch (e) {
      console.error('Failed to persist data:', e)
    }
  }

  async function restoreData() {
    try {
      const data = await readPersisted()
      const lists = data && data.userLists
      if (Array.isArray(lists)) {
        // 保留 default / favorites 结构，合并用户自建列表
        const kept = [...lists]
        for (const builtin of ['default', 'favorites']) {
          const found = kept.find(l => l.id === builtin)
          if (found) {
            found.songs = Array.isArray(found.songs) ? found.songs : []
            found.songs = found.songs.filter(s => s && s.name)
          } else {
            kept.unshift({ id: builtin, name: builtin === 'default' ? '默认列表' : '收藏', songs: [] })
          }
        }
        userLists.value = kept
      }
      const dl = data && data.downloads
      if (Array.isArray(dl)) {
        downloads.value = dl.map(d => ({ ...d, status: 'done', progress: 100 }))
      }
    } catch (e) {
      console.error('Failed to restore data:', e)
    }
  }

  watch(userLists, scheduleSave, { deep: true })
  watch(downloads, scheduleSave, { deep: true })

  async function loadSources() {
    try {
      const list = await api.loadSources()
      sources.value = list
      sourceError.value = ''
      // 不再自动选 activeSource —— 搜索改成聚合所有源
      if (list.length === 0) {
        sourceError.value = '尚未配置音源，请在「设置 → 音源」中导入 lx-music 格式音源脚本'
      }
    } catch (e) {
      console.error('Failed to load sources:', e)
      sourceError.value = '音源加载失败：' + (e.message || e)
    }
  }

  async function search(keyword, page = 1) {
    // 保留方法签名以兼容旧 UI 调用；新 SearchView.vue 走自己的 aggregateSearch
    if (!keyword) return
    isLoading.value = true
    searchKeyword.value = keyword
    searchError.value = ''
    try {
      // 任意选一个源代表搜索（旧路径）
      const sid = activeSource.value || (sources.value[0] && sources.value[0].id)
      if (!sid) {
        searchResults.value = []
        isLoading.value = false
        return
      }
      const data = await api.search(sid, keyword, page)
      searchResults.value = (data && data.list) || []
      searchTotal.value = (data && data.total) || searchResults.value.length
      searchLimit.value = (data && data.limit) || 30
      const allPage = (data && data.allPage) || Math.ceil(searchTotal.value / searchLimit.value)
      searchAllPage.value = Math.max(1, allPage || 1)
      searchPage.value = page
    } catch (e) {
      searchResults.value = []
      searchError.value = '搜索失败：' + (e.message || e)
      console.error('Search failed:', e)
    }
    isLoading.value = false
  }

  function addToList(listId, song) {
    const list = userLists.value.find(l => l.id === listId)
    if (list) list.songs.push(song)
  }

  function removeFromList(listId, index) {
    const list = userLists.value.find(l => l.id === listId)
    if (list) list.songs.splice(index, 1)
  }

  function createList(name) {
    const id = 'list_' + Date.now()
    userLists.value.push({ id, name, songs: [] })
  }

  function deleteList(id) {
    if (id === 'default' || id === 'favorites') return
    userLists.value = userLists.value.filter(l => l.id !== id)
  }

  function addDownload(song, quality) {
    const item = { ...song, status: 'pending', progress: 0, quality: quality || '128k' }
    const existing = downloads.value.find(d => d.songid === song.id && d.source === song.source && d.quality === item.quality)
    if (existing) { existing.status = 'pending'; existing.progress = 0; return existing }
    downloads.value.push(item)
    return item
  }

  async function downloadSong(song, quality) {
    const source = song.source || activeSource.value || 'wy'
    const item = addDownload(song, quality)
    item.status = 'downloading'
    try {
      await downloadMusic(source, song, item.quality)
      item.status = 'done'
      item.progress = 100
      return true
    } catch (e) {
      console.error('Download failed:', e)
      item.status = 'error'
      return Promise.reject(new Error('下载失败：' + (e.message || e)))
    }
  }

  function removeDownload(index) {
    downloads.value.splice(index, 1)
  }
  return {
    sources, activeSource, searchResults, searchKeyword, isLoading, searchError, sourceError,
    searchPage, searchTotal, searchAllPage, searchLimit,
    userLists, downloads, loadSources, search, addToList, removeFromList,
    createList, deleteList, addDownload, downloadSong, removeDownload,
    restoreData
  }
})