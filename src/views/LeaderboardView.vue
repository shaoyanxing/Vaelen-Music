<template>
  <div>
    <div class="content-header">
      <h1>排行榜</h1>
      <div class="source-tabs">
        <button v-for="s in platforms" :key="s"
                :class="{ active: source === s }"
                @click="pickSource(s)"
                :data-testid="'leaderboard-source-' + s">
          {{ nameOf(s) }}
        </button>
      </div>
      <div class="status-bar">
        <span v-if="detailTitle">
          <button class="link-btn" @click="backToList">← 返回榜单列表</button>
          {{ detailTitle }}
        </span>
        <span v-else>共 {{ boards.length }} 个榜单</span>
        <span v-if="detail.length && detailAllPage > 1" class="pager">
          <button @click="goPage(detailPage - 1)" :disabled="loading || detailPage <= 1">‹ 上一页</button>
          <span>第 {{ detailPage }} / {{ detailAllPage }} 页</span>
          <button @click="goPage(detailPage + 1)" :disabled="loading || detailPage >= detailAllPage">下一页 ›</button>
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

      <div v-else-if="boards.length === 0" class="empty-state">
        <div class="empty-icon">♛</div>
        <div class="empty-title">暂无榜单</div>
      </div>

      <div v-else class="board-list" data-testid="board-list">
        <div v-for="(b, i) in boards" :key="b.id" class="board-item"
             @click="openBoard(b)" :title="b.name">
          <span class="board-rank">{{ i + 1 }}</span>
          <img v-if="b.imgUrl" class="board-cover" :src="b.imgUrl" :alt="b.name" loading="lazy" />
          <span v-else class="board-cover fallback">♛</span>
          <span class="board-name">{{ b.name }}</span>
          <span class="board-arrow">›</span>
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
const boards = ref([])
const detail = ref([])
const detailId = ref('')
const detailTitle = ref('')
const loading = ref(false)
const error = ref('')
const detailPage = ref(1)
const detailAllPage = ref(0)

function nameOf(id) {
  return (appStore.sources.find(s => s.id === id)?.name) || platformNames[id] || id
}

async function fetchBoards() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.leaderboards(source.value)
    boards.value = (data && data.list) || []
  } catch (e) {
    error.value = e.message || String(e)
    boards.value = []
  }
  loading.value = false
}

async function fetchDetail(id, page = 1) {
  loading.value = true
  error.value = ''
  try {
    const data = await api.leaderboard(source.value, id, page, 100)
    detail.value = (data && data.list) || []
    const t = (data && data.total) || detail.value.length
    detailAllPage.value = Math.max(1, Math.ceil(t / ((data && data.limit) || 100)))
    detailPage.value = page
  } catch (e) {
    error.value = e.message || String(e)
    detail.value = []
  }
  loading.value = false
}

function pickSource(s) {
  if (source.value === s && boards.value.length) return
  source.value = s
  detail.value = []
  detailId.value = ''
  detailTitle.value = ''
  fetchBoards()
}

function openBoard(b) {
  detailId.value = b.id
  detailTitle.value = b.name || ''
  fetchDetail(b.id, 1)
}

function backToList() {
  detail.value = []
  detailId.value = ''
  detailTitle.value = ''
  detailAllPage.value = 0
  detailPage.value = 1
}

function goPage(page) {
  if (page < 1 || page > detailAllPage.value) return
  fetchDetail(detailId.value, page)
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
  if (source.value) fetchBoards()
  else error.value = '请先在设置中导入音源脚本'
})
</script>