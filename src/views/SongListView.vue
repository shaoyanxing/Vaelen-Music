<template>
  <div>
    <div class="content-header">
      <h1>歌单</h1>
      <div class="source-tabs">
        <button v-for="s in platforms" :key="s"
                :class="{ active: source === s }"
                @click="pickSource(s)"
                :data-testid="'songlist-source-' + s">
          {{ nameOf(s) }}
        </button>
      </div>
      <div class="status-bar">
        <span v-if="detailTitle">
          <button class="link-btn" @click="backToList">← 返回歌单列表</button>
          {{ detailTitle }}
        </span>
        <span v-else-if="total">共 {{ total }} 个歌单</span>
        <span v-if="list.length && allPage > 1" class="pager">
          <button @click="goPage(listPage - 1)" :disabled="loading || listPage <= 1">‹ 上一页</button>
          <span>第 {{ listPage }} / {{ allPage }} 页</span>
          <button @click="goPage(listPage + 1)" :disabled="loading || listPage >= allPage">下一页 ›</button>
        </span>
      </div>
    </div>

    <div class="content-body">
      <div v-if="loading" class="empty-state">
        <div class="loading-spinner" style="width:28px;height:28px"></div>
        <div class="empty-title" style="margin-top:12px">加载中...</div>
      </div>

      <div v-else-if="error" class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">⚠</div>
        <div class="empty-title">加载失败</div>
        <div class="empty-desc">{{ error }}</div>
      </div>

      <div v-else-if="detail.length" class="detail-view">
        <SongTable :songs="detail" :show-fav="true"
                   @play="playSong" @fav="addToFav" @download="downloadSong" />
      </div>

      <div v-else-if="list.length === 0" class="empty-state">
        <div class="empty-icon">☰</div>
        <div class="empty-title">暂无歌单</div>
      </div>

      <div v-else class="playlist-grid" data-testid="playlist-grid">
        <div v-for="pl in list" :key="pl.id" class="playlist-card"
             @click="openList(pl)" :title="pl.name">
          <div class="playlist-cover">
            <img v-if="pl.imgUrl" :src="pl.imgUrl" :alt="pl.name" loading="lazy" />
            <span v-else class="cover-fallback">☰</span>
            <div class="playlist-count">{{ pl.count || 0 }} 首</div>
          </div>
          <div class="playlist-name">{{ pl.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { usePlayerStore, useAppStore } from '../stores'
import SongTable from '../components/SongTable.vue'
import { openDownloadPicker } from '../downloads-ui'

const playerStore = usePlayerStore()
const appStore = useAppStore()

const FALLBACK_PLATFORMS = ['wy', 'tx', 'kw', 'kg', 'mg']
const platformNames = {
  wy: '网易云', tx: 'QQ音乐', kw: '酷我', kg: '酷狗', mg: '咪咕', qs: '汽水',
}

// 选项卡 = 实际已导入的音源（无则回退内置 ID，便于展示）
const platforms = computed(() =>
  appStore.sources.length ? appStore.sources.map(s => s.id) : FALLBACK_PLATFORMS
)

const source = ref('')
const list = ref([])
const detail = ref([])
const detailId = ref('')
const detailTitle = ref('')
const loading = ref(false)
const error = ref('')
const total = ref(0)
const listPage = ref(1)
const allPage = ref(0)
const detailPage = ref(1)
const detailAllPage = ref(0)

function nameOf(id) {
  return (appStore.sources.find(s => s.id === id)?.name) || platformNames[id] || id
}

async function fetchList(page = 1) {
  loading.value = true
  error.value = ''
  try {
    const data = await api.songLists(source.value, 'all', page, 30)
    list.value = (data && data.list) || []
    total.value = (data && data.total) || list.value.length
    allPage.value = Math.max(1, Math.ceil(total.value / ((data && data.limit) || 30)))
    listPage.value = page
  } catch (e) {
    error.value = e.message || String(e)
    list.value = []
  }
  loading.value = false
}

async function fetchDetail(id, page = 1) {
  loading.value = true
  error.value = ''
  try {
    const data = await api.songList(source.value, id, page, 50)
    detail.value = (data && data.list) || []
    const t = (data && data.total) || detail.value.length
    detailAllPage.value = Math.max(1, Math.ceil(t / ((data && data.limit) || 50)))
    detailPage.value = page
  } catch (e) {
    error.value = e.message || String(e)
    detail.value = []
  }
  loading.value = false
}

function pickSource(s) {
  if (source.value === s && list.value.length) return
  source.value = s
  detail.value = []
  detailId.value = ''
  detailTitle.value = ''
  fetchList(1)
}

function openList(pl) {
  detailId.value = pl.id
  detailTitle.value = pl.name || ''
  fetchDetail(pl.id, 1)
}

function backToList() {
  detail.value = []
  detailId.value = ''
  detailTitle.value = ''
  detailAllPage.value = 0
  detailPage.value = 1
}

function goPage(page) {
  if (detailId.value) {
    fetchDetail(detailId.value, page)
  } else if (page >= 1 && page <= allPage.value) {
    fetchList(page)
  }
}

function playSong(index) {
  playerStore.setPlaylist(detail.value)
  playerStore.playSong(index)
}

function addToFav(song) {
  const favList = appStore.userLists.find(l => l.id === 'favorites')
  if (!favList) return
  const idx = favList.songs.findIndex(s => s.id === song.id && s.source === song.source)
  if (idx >= 0) favList.songs.splice(idx, 1)
  else favList.songs.push({ ...song })
}

function downloadSong(song) {
  openDownloadPicker(song)
}

onMounted(() => {
  if (!source.value) source.value = platforms.value[0] || ''
  if (source.value) fetchList(1)
  else error.value = '请先在设置中导入音源脚本'
})
</script>