<template>
  <transition name="np-fade">
    <div v-if="visible" class="np-root" data-testid="now-playing"
         :class="{ 'np-dragging': dragging }"
         :style="rootStyle"
         @pointerdown="onDragStart"
         @pointermove="onDragMove"
         @pointerup="onDragEnd"
         @pointercancel="onDragEnd">
      <!-- 背景：深色底层 + 高斯模糊磨玻璃（不依赖封面图） -->
      <div class="np-bg">
        <div class="np-bg-vignette"></div>
        <div class="np-bg-noise"></div>
      </div>

      <div class="np-frame">
        <!-- 顶栏 -->
        <div class="np-top">
          <button class="np-icon-btn" @click="close" aria-label="收起 (Esc)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="np-top-text">
            <div class="np-top-sub">正在播放</div>
            <div class="np-top-title">{{ songTitle }}</div>
          </div>
          <button class="np-icon-btn" @click="onMore" aria-label="更多">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
          </button>
        </div>

        <!-- 主体：左封面 + 元数据 + 控制；右滚动歌词 -->
        <div class="np-body" :class="{ 'np-body-mobile': isMobile }">
          <!-- 左：封面 / 元数据 / 喜欢 / 控制 -->
          <div class="np-left">
            <div class="np-cover" :class="{ spinning: isPlaying }" @click="onCoverClick">
              <img v-if="coverUrl" :src="coverUrl" alt="" draggable="false" />
              <div v-else class="np-cover-fallback">♫</div>
            </div>
            <div class="np-meta">
              <div class="np-title" :title="songTitle">{{ songTitle }}</div>
              <div class="np-artist" :title="songArtist">
                <span v-for="(s, i) in songArtistList" :key="i">
                  <a v-if="s.link" :href="s.link" target="_blank" rel="noopener">{{ s.name }}</a>
                  <span v-else>{{ s.name }}</span>
                  <span v-if="i < songArtistList.length - 1"> / </span>
                </span>
              </div>
              <div v-if="songAlbum" class="np-album">— {{ songAlbum }}</div>
            </div>
            <div class="np-actions">
              <button
                class="np-action-btn"
                :class="{ active: isFav }"
                @click="toggleFav"
                :title="isFav ? '取消喜欢' : '喜欢'"
                data-testid="np-fav"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" :fill="isFav ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
                  <path d="M12 21s-7-4.5-9-9.5C1.5 7.5 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 22.5 7.5 21 11.5c-2 5-9 9.5-9 9.5z"/>
                </svg>
                <span>喜欢</span>
              </button>
              <button class="np-action-btn" @click="download" title="下载" data-testid="np-download">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>下载</span>
              </button>
            </div>
          </div>

          <!-- 右：滚动歌词 -->
          <div class="np-right">
            <div class="np-lyric" ref="lyricEl" @scroll="onLyricScroll" :class="{ 'np-lyric-mobile': isMobile }">
              <div class="np-lyric-spacer"></div>
              <p
                v-for="(line, i) in lines"
                :key="i"
                :class="{
                  active: i === activeIndex,
                  near: i !== activeIndex && Math.abs(i - activeIndex) <= 1,
                }"
              >
                <span v-if="line.text" class="np-line-text">{{ line.text }}</span>
                <span v-else class="np-line-text np-line-blank">·</span>
              </p>
              <div v-if="!lines.length" class="np-lyric-empty">
                <div class="np-lyric-empty-icon">♪</div>
                <div>暂无歌词</div>
              </div>
              <div class="np-lyric-spacer"></div>
            </div>
          </div>
        </div>

        <!-- 底部控制 -->
        <div class="np-bottom">
          <div v-if="playerStore.playError" class="np-error" data-testid="np-error">
            <span>{{ playerStore.playError }}</span>
            <button class="np-error-close" @click="playerStore.playError = ''" aria-label="关闭">✕</button>
          </div>
          <div class="np-progress">
            <span class="np-time">{{ formatTime(currentTime) }}</span>
            <div class="np-progress-bar" @click="onSeek" ref="progressEl" data-testid="np-progress-bar">
              <div class="np-progress-buffered" :style="{ width: bufferedPercent + '%' }"></div>
              <div class="np-progress-fill" :style="{ width: progressPercent + '%' }"></div>
              <div class="np-progress-thumb" :style="{ left: progressPercent + '%' }"></div>
            </div>
            <span class="np-time">{{ formatTime(duration) }}</span>
          </div>

          <div class="np-buttons">
            <button class="np-mode-btn" :title="modeTitle" @click="cycleMode" data-testid="np-mode">
              <span v-if="playMode === 'list'">🔁</span>
              <span v-else-if="playMode === 'shuffle'">🔀</span>
              <span v-else>🔂</span>
            </button>
            <button class="np-step-btn" title="上一首 (←)" @click="playerStore.playPrev()" :disabled="!playerStore.hasPrev" data-testid="np-prev">⏮</button>
            <button class="np-play-btn" :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'" @click="togglePlay" data-testid="np-play">
              <svg v-if="isPlaying" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
              <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button class="np-step-btn" title="下一首 (→)" @click="playerStore.playNext()" :disabled="!playerStore.hasNext" data-testid="np-next">⏭</button>
            <button class="np-mode-btn" :title="'音质 ' + qualityLabel" @click="cycleQuality" data-testid="np-quality">
              <span class="np-quality-label">{{ qualityLabel }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usePlayerStore, useAppStore } from '../stores'
import { downloadMusic } from '../api'
import { parseLrc, findLyricIndex } from '../utils/lrc'
import { openDownloadPicker } from '../downloads-ui'

const playerStore = usePlayerStore()
const appStore = useAppStore()

const visible = computed(() => !!playerStore.currentSong && playerStore.fullscreen)

const coverUrl = computed(() => playerStore.currentSong?.img || '')
const songTitle = computed(() => playerStore.currentSong?.name || '未播放')
const songArtist = computed(() => playerStore.currentSong?.singer || '')
// 拆分歌手字符串（"周杰伦、方文山"）支持点击
const songArtistList = computed(() => {
  const raw = songArtist.value
  if (!raw) return []
  return raw.split(/[、,/&]/).map(s => s.trim()).filter(Boolean).map(name => ({ name, link: null }))
})
const songAlbum = computed(() => playerStore.currentSong?.albumName || '')
const isPlaying = computed(() => playerStore.isPlaying)
const playMode = computed(() => playerStore.playMode)
const currentTime = computed(() => playerStore.currentTime)
const duration = computed(() => playerStore.duration || 0)

const modeTitle = computed(() => ({
  list: '列表循环', shuffle: '随机播放', repeat: '单曲循环',
}[playMode.value] || '列表循环'))

const qualityOrder = ['128k', '320k', 'flac', 'flac24bit', 'hires', 'master']
const qualityLabel = computed(() => playerStore.quality.toUpperCase())

function cycleMode() { playerStore.cyclePlayMode() }
function cycleQuality() {
  const i = qualityOrder.indexOf(playerStore.quality)
  playerStore.setQuality(qualityOrder[(i + 1) % qualityOrder.length])
}
function togglePlay() { playerStore.togglePlay() }
function close() { playerStore.fullscreen = false }
function onCoverClick() { close() }  // 再次点击封面收起（但可由 App.vue 拦截）
function onMore() { /* TODO: 更多菜单 */ }

// ============ 下滑关闭手势 ============
// 向下拖动跟手（带阻尼），超过阈值或快速甩动 → 关闭；否则回弹
const dragging = ref(false)
const dragDy = ref(0)
let dragStartY = 0
let dragLastY = 0
let dragLastT = 0
let dragVelocity = 0
let rootEl = null

const rootStyle = computed(() => {
  if (!dragging.value || !dragDy.value) return {}
  return { transform: `translateY(${dragDy.value}px)` }
})

function onDragStart(e) {
  // 只响应主键（鼠标左键 / 触摸）
  if (e.button !== undefined && e.button !== 0) return
  // 歌词区、进度条、按钮、封面（点击封面本身就是收起）不劫持为下滑手势
  const t = e.target
  if (t && (t.closest?.('.np-lyric') || t.closest?.('.np-progress-bar') || t.closest?.('button') || t.closest?.('.np-cover'))) return
  rootEl = e.currentTarget
  dragging.value = true
  dragDy.value = 0
  dragStartY = e.clientY
  dragLastY = e.clientY
  dragLastT = performance.now()
  dragVelocity = 0
}

function onDragMove(e) {
  if (!dragging.value) return
  const now = performance.now()
  const dt = now - dragLastT
  if (dt > 0) dragVelocity = (e.clientY - dragLastY) / dt
  dragLastY = e.clientY
  dragLastT = now
  const dy = e.clientY - dragStartY
  // 阻尼：向下 1:1，向上抵一半，避免误触
  dragDy.value = dy > 0 ? dy : dy * 0.5
}

function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  const dy = dragDy.value
  dragDy.value = 0
  const threshold = window.innerHeight * 0.22
  const fast = Math.abs(dragVelocity) > 0.7
  if (dy > threshold || (dy > 48 && fast)) close()
  // 否则回弹（transition 自动衔接）
  rootEl = null
}

// ============ 歌词 ============
const lrcRaw = computed(() => playerStore.lyrics?.lyric || '')
const lines = computed(() => parseLrc(lrcRaw.value).lines)
const activeIndex = computed(() => findLyricIndex(lines.value, currentTime.value))

const lyricEl = ref(null)
const progressEl = ref(null)
const bufferedPercent = ref(0)
let userScrolling = false
let userScrollTimer = null

function onLyricScroll() {
  userScrolling = true
  clearTimeout(userScrollTimer)
  userScrollTimer = setTimeout(() => { userScrolling = false }, 4000)
}

watch([activeIndex, visible], async () => {
  if (!visible.value || userScrolling) return
  await nextTick()
  const el = lyricEl.value
  if (!el) return
  const active = el.querySelector('p.active')
  if (!active) return
  const target = active.offsetTop - el.clientHeight / 2 + active.clientHeight / 2
  el.scrollTo({ top: target, behavior: 'smooth' })
})

// ============ 进度 ============
const progressPercent = computed(() =>
  !duration.value ? 0 : Math.min(100, (currentTime.value / duration.value) * 100)
)

function onSeek(e) {
  const el = progressEl.value
  if (!el || !duration.value) return
  const rect = el.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  playerStore.setCurrentTime(pct * duration.value)
  const audio = document.querySelector('[data-testid="audio-element"]')
  if (audio) audio.currentTime = pct * duration.value
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

// ============ 喜欢 / 下载 ============
const isFav = computed(() => {
  const cur = playerStore.currentSong
  if (!cur) return false
  const fav = appStore.userLists.find(l => l.id === 'favorites')
  return !!fav?.songs.some(s => s.id === cur.id && s.source === cur.source)
})
function toggleFav() {
  const cur = playerStore.currentSong
  if (!cur) return
  const fav = appStore.userLists.find(l => l.id === 'favorites')
  if (!fav) return
  const idx = fav.songs.findIndex(s => s.id === cur.id && s.source === cur.source)
  if (idx >= 0) fav.songs.splice(idx, 1)
  else fav.songs.push({ ...cur })
}
async function download() {
  const cur = playerStore.currentSong
  if (!cur) return
  openDownloadPicker(cur)
}

// ============ 响应式 ============
const isMobile = ref(false)
function checkMobile() { isMobile.value = window.innerWidth < 760 }
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onBeforeUnmount(() => window.removeEventListener('resize', checkMobile))

// ============ 快捷键 ============
function onKey(e) {
  if (!visible.value) return
  const tag = (e.target?.tagName || '').toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if (e.code === 'Escape') { e.preventDefault(); close() }
  else if (e.code === 'ArrowLeft' && playerStore.hasPrev) { e.preventDefault(); playerStore.playPrev() }
  else if (e.code === 'ArrowRight' && playerStore.hasNext) { e.preventDefault(); playerStore.playNext() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.np-root {
  position: fixed; inset: 0; z-index: 200;
  display: flex; flex-direction: column;
  color: #fff; overflow: hidden; isolation: isolate;
  will-change: transform;
  /* 磨玻璃：90% 不透明深底 + 高斯模糊，不透不花 */
  background: rgba(14, 15, 20, 0.92);
  backdrop-filter: blur(32px) saturate(1.2);
  -webkit-backdrop-filter: blur(32px) saturate(1.2);
}

/* 背景 */
.np-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.np-bg-vignette {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 120% 90% at 50% -10%, rgba(255, 255, 255, 0.045), transparent 55%),
    radial-gradient(ellipse 100% 80% at 50% 110%, rgba(0, 0, 0, 0.5), transparent 60%);
}
.np-bg-noise {
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size: 200px 200px;
  mix-blend-mode: overlay; opacity: 0.5;
}

/* 容器 */
.np-frame {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  height: 100%;
  padding: 0 6% 28px;
}

/* 顶栏 */
.np-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 0 12px; flex-shrink: 0;
}
.np-top-text { text-align: center; min-width: 0; flex: 1; padding: 0 12px; }
.np-top-sub { font-size: var(--font-size-xs); color: rgba(255,255,255,0.55); letter-spacing: 0.05em; }
.np-top-title {
  font-size: var(--font-size-md); font-weight: 600; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.np-icon-btn {
  background: transparent; border: none; color: rgba(255,255,255,0.7);
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; cursor: pointer; transition: all 0.15s;
}
.np-icon-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }

/* 主体：左右布局 */
.np-body {
  flex: 1; min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 1.05fr) minmax(300px, 1fr);
  gap: 56px;
  align-items: center;
  padding: 12px 0 16px;
}
.np-body-mobile { grid-template-columns: 1fr; gap: 16px; padding: 4px 0 8px; }

/* 左列 */
.np-left {
  display: flex; flex-direction: column; align-items: center; gap: 24px;
  min-width: 0;
}
.np-cover {
  width: min(46vh, 360px);
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
  box-shadow: 0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.6s var(--ease-out), box-shadow 0.3s;
}
.np-cover:hover { box-shadow: 0 36px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1) inset; }
.np-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.np-cover-fallback {
  font-size: 100px; color: rgba(255,255,255,0.18);
  display: flex; align-items: center; justify-content: center;
}
/* 播放时封面呼吸：稍微放大 + 增强阴影 */
.np-cover.spinning { animation: np-cover-breath 4s ease-in-out infinite; }
@keyframes np-cover-breath {
  0%, 100% { transform: scale(1.0); }
  50% { transform: scale(1.015); }
}

.np-meta {
  text-align: center; max-width: 100%; min-width: 0; padding: 0 12px;
}
.np-title {
  font-size: var(--font-size-xl); font-weight: 700; color: #fff;
  letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-shadow: 0 2px 12px rgba(0,0,0,0.5);
}
.np-artist {
  font-size: var(--font-size-md); color: rgba(255,255,255,0.75);
  margin-top: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.np-artist a { color: inherit; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.2); }
.np-artist a:hover { color: #fff; border-bottom-color: #fff; }
.np-album {
  font-size: var(--font-size-sm); color: rgba(255,255,255,0.5);
  margin-top: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.np-actions {
  display: flex; align-items: center; gap: 14px;
}
.np-action-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  color: rgba(255,255,255,0.7);
  font-size: var(--font-size-sm); font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.np-action-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
.np-action-btn.active {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.12);
  border-color: rgba(255, 59, 48, 0.4);
}
.np-action-btn.active:hover { background: rgba(255, 59, 48, 0.18); }

/* 右列：歌词 */
.np-right { min-width: 0; height: 100%; display: flex; align-items: center; }
.np-lyric {
  width: 100%;
  height: 64vh; max-height: 560px;
  overflow-y: auto; scroll-behavior: smooth;
  text-align: center;
  font-size: var(--font-size-md); line-height: 1.95;
  mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 88%, transparent 100%);
  padding: 0 8px;
}
.np-lyric-mobile { height: 30vh; max-height: 220px; }
.np-lyric-spacer { height: 50%; }
.np-lyric p {
  margin: 0; padding: 6px 0;
  color: rgba(255,255,255,0.4);
  transition: color 0.4s var(--ease-out), font-weight 0.4s, letter-spacing 0.4s, opacity 0.4s, transform 0.4s;
  font-weight: 400; letter-spacing: 0; word-break: break-word;
  will-change: transform, color, opacity;
}
.np-lyric p.near { color: rgba(255,255,255,0.65); }
.np-lyric p.active {
  color: #fff; font-weight: 700;
  font-size: calc(var(--font-size-md) * 1.12);
  letter-spacing: 0.01em;
  text-shadow: 0 0 24px rgba(255,255,255,0.3);
}
.np-lyric-empty {
  text-align: center; color: rgba(255,255,255,0.4);
  margin-top: 30%;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  font-size: var(--font-size-sm);
}
.np-lyric-empty-icon { font-size: 40px; opacity: 0.5; }
.np-line-blank { opacity: 0.4; letter-spacing: 0.4em; }

/* 底部控制 */
.np-bottom {
  flex-shrink: 0;
  display: flex; flex-direction: column; gap: 14px;
  padding-top: 4px;
}
.np-progress {
  display: flex; align-items: center; gap: 12px;
}
.np-time {
  font-family: var(--font-mono); font-size: var(--font-size-xs);
  color: rgba(255,255,255,0.7); min-width: 38px; text-align: center;
}
.np-progress-bar {
  flex: 1; height: 4px; position: relative;
  background: rgba(255,255,255,0.15);
  border-radius: 2px; cursor: pointer; overflow: visible;
  transition: height 0.15s;
}
.np-progress-bar:hover { height: 6px; }
.np-progress-buffered, .np-progress-fill {
  position: absolute; top: 0; left: 0; height: 100%; border-radius: 2px; pointer-events: none;
}
.np-progress-buffered { background: rgba(255,255,255,0.18); }
.np-progress-fill { background: var(--accent); box-shadow: 0 0 12px var(--accent-glow); }
.np-progress-thumb {
  position: absolute; top: 50%;
  width: 12px; height: 12px; border-radius: 50%; background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  opacity: 0; transition: opacity 0.15s; pointer-events: none;
}
.np-progress-bar:hover .np-progress-thumb { opacity: 1; }

.np-buttons { display: flex; align-items: center; justify-content: center; gap: 28px; }
.np-mode-btn, .np-step-btn, .np-play-btn {
  background: transparent; border: none; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.np-mode-btn { font-size: 18px; width: 32px; height: 32px; border-radius: 50%; }
.np-mode-btn:hover { background: rgba(255,255,255,0.08); }
.np-step-btn { font-size: 26px; width: 44px; height: 44px; border-radius: 50%; }
.np-step-btn:hover { background: rgba(255,255,255,0.08); }
.np-step-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.np-step-btn:disabled:hover { background: transparent; }
.np-play-btn {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--accent); color: var(--text-inverse);
  box-shadow: 0 8px 24px var(--accent-glow), 0 0 0 1px rgba(255,255,255,0.08) inset;
}
.np-play-btn:hover { background: var(--accent-dim); transform: scale(1.05); }
.np-quality-label { font-size: var(--font-size-xs); font-family: var(--font-mono); }

/* 过渡：从底部滑入，带变速（快起慢停） */
.np-fade-enter-active, .np-fade-leave-active {
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}
.np-fade-enter-from { transform: translateY(100%); opacity: 0.4; }
.np-fade-leave-to { transform: translateY(100%); opacity: 0; }

/* 手势跟手拖动中：禁用过渡，完全跟随手指/鼠标 */
.np-root.np-dragging {
  transition: none;
}

/* 滚动条 */
.np-lyric::-webkit-scrollbar { width: 4px; }
.np-lyric::-webkit-scrollbar-track { background: transparent; }
.np-lyric::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.np-lyric::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }

/* 错误条（覆盖在底部控制之上） */
.np-error {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px 8px 16px;
  background: rgba(229, 72, 77, 0.92);
  color: #fff;
  border-radius: 8px;
  font-size: var(--font-size-sm);
  box-shadow: 0 6px 20px rgba(229, 72, 77, 0.35);
  backdrop-filter: blur(8px);
}
.np-error-close {
  background: transparent; border: none; color: rgba(255,255,255,0.85);
  cursor: pointer; font-size: 14px; padding: 2px 6px;
  border-radius: 4px; line-height: 1;
}
.np-error-close:hover { background: rgba(0,0,0,0.2); color: #fff; }
</style>
