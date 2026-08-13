<template>
  <div>
    <div class="content-header">
      <h1>搜索</h1>
      <div class="status-bar">
        <span>
          <span class="status-dot" :class="{ error: !appStore.sources.length }"></span>
          {{ appStore.sources.length }} 个音源已加载
        </span>
        <span v-if="!appStore.sources.length" style="color:var(--danger)">请先在设置中导入音源</span>
        <span v-else-if="totalCount > 0">找到 {{ totalCount }} 首歌曲</span>
        <span v-if="loadingCount" style="color:var(--text-tertiary)">
          <span class="loading-spinner" style="width:10px;height:10px;display:inline-block;vertical-align:-1px;margin-right:4px"></span>
          正在聚合 {{ doneCount }} / {{ appStore.sources.length }} 个音源…
        </span>
      </div>
      <div class="search-bar">
        <input v-model="keyword" placeholder="输入歌曲名、歌手或专辑名..."
               @keydown.enter="doSearch" :disabled="!appStore.sources.length" data-testid="search-input" />
        <button @click="doSearch" :disabled="appStore.isLoading || !appStore.sources.length" data-testid="search-btn">
          <span v-if="appStore.isLoading" class="loading-spinner"></span>
          <span v-else>搜索</span>
        </button>
      </div>
      <div class="quality-bar">
        <label>音质</label>
        <button v-for="q in qualities" :key="q.value"
                class="quality-btn" :class="{ active: playerStore.quality === q.value }"
                @click="playerStore.setQuality(q.value)"
                :data-testid="'quality-' + q.value">
          {{ q.label }}
        </button>
      </div>
    </div>

    <div class="content-body">
      <div v-if="appStore.isLoading && !mergedResults.length" class="empty-state">
        <div class="loading-spinner" style="width:28px;height:28px"></div>
        <div class="empty-title" style="margin-top:12px">聚合搜索中…</div>
      </div>

      <div v-else-if="appStore.searchError" class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">⚠</div>
        <div class="empty-title">搜索失败</div>
        <div class="empty-desc">{{ appStore.searchError }}</div>
      </div>

      <div v-else-if="!appStore.sources.length" class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">尚未配置音源</div>
        <div class="empty-desc">
          请前往 <router-link to="/settings" style="color:var(--accent)">设置 → 音源</router-link> 导入 lx-music 格式的音源脚本
        </div>
      </div>

      <div v-else-if="!mergedResults.length && keyword && !appStore.isLoading" class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">未找到结果</div>
        <div class="empty-desc">试试其他关键词</div>
      </div>

      <div v-else-if="!mergedResults.length" class="empty-state">
        <div class="empty-icon">⌕</div>
        <div class="empty-title">输入关键词开始搜索</div>
        <div class="empty-desc">会同时从所有已加载的音源聚合，结果随机打乱</div>
      </div>

      <table v-else class="song-table" data-testid="song-list">
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>歌曲</th>
            <th>歌手</th>
            <th>专辑</th>
            <th style="width:64px">时长</th>
            <th style="width:64px">来源</th>
            <th style="width:88px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(song, index) in mergedResults" :key="songKey(song, index)"
              :class="{ playing: isCurrentSong(song) }"
              @dblclick="playSong(index)">
            <td class="song-index">{{ index + 1 }}</td>
            <td>{{ song.name || '未知' }}</td>
            <td>{{ song.singer || '未知' }}</td>
            <td>{{ song.albumName || '' }}</td>
            <td style="font-family:var(--font-mono);font-size:var(--font-size-xs);color:var(--text-tertiary)">
              {{ formatDuration(song.duration ?? song.interval) }}
            </td>
            <td>
              <span class="song-source-tag" :class="sourceTagClass(song.source)">{{ sourceLabel(song.source) }}</span>
            </td>
            <td class="actions">
              <button @click.stop="playSong(index)" title="播放">▶</button>
              <button class="fav-btn" :class="{ faved: isFav(song) }"
                      @click.stop="addToFav(song)" :title="isFav(song) ? '取消收藏' : '收藏'">
                {{ isFav(song) ? '♥' : '♡' }}
              </button>
              <button @click.stop="downloadSong(song)" title="下载">↓</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { usePlayerStore, useAppStore } from '../stores'
import { api } from '../api'
import { openDownloadPicker } from '../downloads-ui'

const playerStore = usePlayerStore()
const appStore = useAppStore()
const keyword = ref('')

const qualities = [
  { label: '128K', value: '128k' },
  { label: '320K', value: '320k' },
  { label: 'FLAC', value: 'flac' },
  { label: '24Bit', value: 'flac24bit' },
  { label: 'Hi-Res', value: 'hires' },
  { label: 'Master', value: 'master' },
]

// 源 ID → 显示名 / 颜色
const SOURCE_LABELS = {
  wy: '网易云', tx: 'QQ', kw: '酷我', kg: '酷狗', mg: '咪咕', qs: '汽水',
}
const SOURCE_COLOR_CLASS = {
  wy: 'src-wy', tx: 'src-tx', kw: 'src-kw', kg: 'src-kg', mg: 'src-mg', qs: 'src-qs',
}
function sourceLabel(id) { return SOURCE_LABELS[id] || id || '-' }
function sourceTagClass(id) { return SOURCE_COLOR_CLASS[id] || 'src-default' }

// 聚合：每个音源并发搜，结果合并 + 去重 + 随机打乱
const mergedResults = ref([])
const loadingCount = ref(0)
const doneCount = ref(0)
const totalCount = ref(0)
let activeSearchId = 0

// 结果去重键（同一首歌可能在多个源出现）
function songKey(song, idx) {
  return (song.id || `${song.name}_${song.singer}`) + '_' + idx
}

function isSameSong(a, b) {
  if (!a || !b) return false
  if (a.id && b.id && a.source && b.source) return a.id === b.id && a.source === b.source
  if (a.id && b.id) return a.id === b.id
  return (a.name || '').trim() === (b.name || '').trim()
    && (a.singer || '').trim() === (b.singer || '').trim()
}

// 鱼洗牌
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function aggregateSearch(q) {
  const sources = appStore.sources
  if (!sources.length) {
    mergedResults.value = []
    totalCount.value = 0
    appStore.isLoading = false
    return
  }
  const searchId = ++activeSearchId
  loadingCount.value = sources.length
  doneCount.value = 0
  mergedResults.value = []
  totalCount.value = 0
  appStore.isLoading = true
  appStore.searchError = ''

  const tasks = sources.map(async (src) => {
    try {
      const data = await api.search(src.id, q, 1)
      if (searchId !== activeSearchId) return []
      doneCount.value++
      return (data?.list || []).filter(Boolean)
    } catch (e) {
      if (searchId !== activeSearchId) return []
      doneCount.value++
      console.warn(`[search ${src.id}] failed:`, e.message)
      return []
    }
  })

  // 拿到第一个结果就先显示，其余陆续补
  let firstShown = false
  await Promise.all(tasks.map(async t => {
    const list = await t
    if (searchId !== activeSearchId) return
    if (!firstShown && list.length) {
      mergedResults.value = shuffle(dedupe([...mergedResults.value, ...list]))
      firstShown = true
    } else {
      mergedResults.value = shuffle(dedupe([...mergedResults.value, ...list]))
    }
    totalCount.value = mergedResults.value.length
  }))

  if (searchId === activeSearchId) {
    mergedResults.value = shuffle(dedupe(mergedResults.value))
    totalCount.value = mergedResults.value.length
    loadingCount.value = 0
    appStore.isLoading = false
  }
}

function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const s of list) {
    const key = (s.id && s.source) ? `${s.source}:${s.id}` : `${s.name}|${s.singer}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function doSearch() {
  const q = keyword.value.trim()
  if (!q) return
  aggregateSearch(q)
}

function playSong(index) {
  playerStore.setPlaylist(mergedResults.value)
  playerStore.playSong(index)
}

function isCurrentSong(song) {
  const cur = playerStore.currentSong
  if (!cur) return false
  if (song.id && cur.id && song.source && cur.source) {
    return song.id === cur.id && song.source === cur.source
  }
  return cur.name === song.name && cur.singer === song.singer
}

function addToFav(song) {
  const fav = appStore.userLists.find(l => l.id === 'favorites')
  if (!fav) return
  const idx = fav.songs.findIndex(s => isSameSong(s, song))
  if (idx >= 0) fav.songs.splice(idx, 1)
  else fav.songs.push({ ...song })
}

function isFav(song) {
  if (!song) return false
  const fav = appStore.userLists.find(l => l.id === 'favorites')
  return !!fav?.songs.some(s => isSameSong(s, song))
}

function downloadSong(song) {
  openDownloadPicker(song)
}

function formatDuration(sec) {
  if (!sec) return '--:--'
  if (typeof sec === 'string' && sec.includes(':')) return sec
  const s = Number(sec)
  if (!isFinite(s) || isNaN(s)) return '--:--'
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return m + ':' + (ss < 10 ? '0' : '') + ss
}

onBeforeUnmount(() => {
  // 离开页面时取消未完成的搜索
  activeSearchId++
})
</script>

<style scoped>
/* 源标签多色 */
:deep(.song-source-tag.src-wy) { background: rgba(232, 59, 59, 0.18); color: #ff7066; border: 1px solid rgba(232, 59, 59, 0.3); }
:deep(.song-source-tag.src-tx) { background: rgba(18, 183, 106, 0.18); color: #2dd396; border: 1px solid rgba(18, 183, 106, 0.3); }
:deep(.song-source-tag.src-kw) { background: rgba(255, 138, 0, 0.18); color: #ffa84d; border: 1px solid rgba(255, 138, 0, 0.3); }
:deep(.song-source-tag.src-kg) { background: rgba(91, 155, 213, 0.18); color: #6db1e8; border: 1px solid rgba(91, 155, 213, 0.3); }
:deep(.song-source-tag.src-mg) { background: rgba(192, 64, 192, 0.18); color: #d76bd7; border: 1px solid rgba(192, 64, 192, 0.3); }
:deep(.song-source-tag.src-qs) { background: rgba(0, 200, 200, 0.18); color: #4dd6d6; border: 1px solid rgba(0, 200, 200, 0.3); }

.actions button.fav-btn.faved {
  color: #ff3b30;
}
:deep(.song-source-tag.src-default) { background: var(--bg-elevated); color: var(--text-tertiary); }
</style>
