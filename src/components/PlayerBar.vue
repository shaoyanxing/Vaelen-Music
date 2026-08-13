<template>
  <div class="player-bar" data-testid="player"
       @pointerdown="onSwipeStart">
    <div class="player-info">
      <div class="player-cover" :class="{ playing: playerStore.isPlaying, clickable: !!playerStore.currentSong }"
           @click="openNowPlaying"
           data-testid="player-cover">
        <span v-if="!playerStore.currentSong">♫</span>
        <img v-else-if="coverUrl" :src="coverUrl" alt="" />
        <span v-else>♫</span>
      </div>
      <div class="player-text">
        <div class="player-title" data-testid="player-title">
          {{ playerStore.currentSong ? playerStore.currentSong.name : '未播放' }}
        </div>
        <div class="player-artist">
          {{ playerStore.currentSong ? playerStore.currentSong.singer : '' }}
        </div>
      </div>
    </div>

    <div class="player-controls">
      <button class="player-btn" :title="modeTitle" @click="playerStore.cyclePlayMode()" data-testid="mode-btn">
        <span v-if="playerStore.playMode === 'list'">🔁</span>
        <span v-else-if="playerStore.playMode === 'shuffle'">🔀</span>
        <span v-else>🔂</span>
      </button>
      <button class="player-btn" data-testid="prev-btn" @click="playerStore.playPrev()" :disabled="!playerStore.hasPrev">⏮</button>
      <button class="player-btn play" data-testid="play-btn" @click="togglePlay">
        {{ playerStore.isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="player-btn" data-testid="next-btn" @click="playerStore.playNext()" :disabled="!playerStore.hasNext">⏭</button>
    </div>

    <div class="player-progress">
      <span class="progress-time">{{ formatTime(playerStore.currentTime) }}</span>
      <div class="progress-bar" @click="seek" data-testid="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <span class="progress-time">{{ formatTime(playerStore.duration) }}</span>
    </div>

    <div class="player-extra">
      <div class="volume-bar">
        <span style="font-size:12px;color:var(--text-tertiary)">🔊</span>
        <input type="range" min="0" max="1" step="0.01"
          :value="playerStore.volume"
          @input="playerStore.setVolume(parseFloat($event.target.value))" />
      </div>
      <button class="player-btn" title="播放页" @click="openNowPlaying">词</button>
      <button class="player-btn" title="下载" @click="downloadCurrent" data-testid="download-btn">↓</button>
    </div>

    <audio
      v-show="playerStore.currentUrl"
      ref="audioEl"
      preload="auto"
      :volume="playerStore.volume"
      data-testid="audio-element"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoaded"
      @ended="onEnded"
      @play="onPlayEvent"
      @pause="onPauseEvent"
      @error="onAudioError"
      @stalled="onAudioStalled"
      @waiting="onAudioWaiting"
      @canplay="onAudioCanPlay"
    ></audio>

<div v-if="playerStore.playError" class="player-error" data-testid="player-error">
        <span>{{ playerStore.playError }}</span>
        <button class="player-error-close" @click="playerStore.playError = ''" aria-label="关闭">✕</button>
      </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { usePlayerStore, useAppStore } from '../stores'
import { api, downloadMusic } from '../api'
import { openDownloadPicker } from '../downloads-ui'

const playerStore = usePlayerStore()
const appStore = useAppStore()
const audioEl = ref(null)
const coverUrl = ref('')

function openNowPlaying() {
  if (!playerStore.currentSong) return
  playerStore.fullscreen = true
}

// ============ 上滑打开 NowPlaying ============
// 在底栏向上滑动（拉开）→ 打开全屏播放页；带速度判定，避免误触。
// 注意：不用 setPointerCapture（会劫持进度条/音量条的 click），
// 改为在 window 上监听 move/up 判定。
let swipeStartY = 0
let swipeStartX = 0
let swipeActive = false
let swipeFired = false

function onSwipeStart(e) {
  if (e.button !== undefined && e.button !== 0) return
  // 进度条拖动（seek）与音量条不参与上滑手势
  const t = e.target
  if (t && (t.closest?.('.progress-bar') || t.closest?.('input'))) return
  swipeStartY = e.clientY
  swipeStartX = e.clientX
  swipeActive = true
  swipeFired = false
}

function onWinSwipeMove(e) {
  if (!swipeActive || swipeFired) return
  const dy = swipeStartY - e.clientY // 上滑为正
  if (dy > 70) {
    swipeFired = true
    swipeActive = false
    openNowPlaying()
  }
}

function onWinSwipeEnd(e) {
  if (!swipeActive) return
  swipeActive = false
  // 兜底：如果本次是 click（无位移），不触发任何行为
}

const progressPercent = computed(() => {
  if (!playerStore.duration) return 0
  return (playerStore.currentTime / playerStore.duration) * 100
})

const modeTitle = computed(() => {
  const t = { list: '列表循环', shuffle: '随机播放', repeat: '单曲循环' }
  return t[playerStore.playMode] || '列表循环'
})

function togglePlay() {
  const audio = audioEl.value
  if (!audio) {
    // 没有 audio 元素（currentUrl 为空或未加载完）→ 触发一次拉取
    if (!playerStore.currentUrl) playerStore.fetchMusicUrl()
    return
  }
  if (audio.paused) {
    audio.play().catch(err => {
      playerStore.playError = '播放失败：' + (err.message || err)
      playerStore.isPlaying = false
    })
  } else {
    audio.pause()
  }
}

function onPlayEvent() {
  playerStore.isPlaying = true
  // 保留「已自动降级」提示，其余错误在恢复播放时清除
  if (!playerStore.playError || !playerStore.playError.includes('已自动降级')) {
    playerStore.playError = ''
  }
}

function onPauseEvent() {
  playerStore.isPlaying = false
}

function onTimeUpdate() {
  if (audioEl.value) playerStore.setCurrentTime(audioEl.value.currentTime)
}

function onLoaded() {
  clearLoadTimeout()
  if (audioEl.value) {
    playerStore.setDuration(audioEl.value.duration)
  }
}

function onAudioError() {
  clearLoadTimeout()
  playerStore.isPlaying = false
  if (playerStore.currentUrl) {
    // URL 播不了：可能是无该音质/链接失效，交给 store 做降级重试
    playerStore.handleAudioError()
  }
}

// 缓冲中（浏览器等待数据时触发）。不视为错误——仅记录状态。
function onAudioWaiting() {
  // 不修改 isPlaying；缓冲恢复后会自动继续
}
// stalled 与 waiting 类似，但发生在已部分下载后；不视为错误
function onAudioStalled() { /* silent */ }
function onAudioCanPlay() { /* ready to resume without rebuffering */ }

function onEnded() {
  if (playerStore.playMode === 'repeat') {
    const audio = audioEl.value
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }
    return
  }
  playerStore.nextAuto()
}

function seek(e) {
  if (!audioEl.value || !playerStore.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  audioEl.value.currentTime = pct * playerStore.duration
}

async function downloadCurrent() {
  const song = playerStore.currentSong
  if (!song || !playerStore.currentUrl) return
  openDownloadPicker(song)
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m + ':' + (sec < 10 ? '0' : '') + sec
}

// 同步 currentUrl -> audio.src，避开 mid-playback 重置
// 关键：仅当 URL 真正变化时改 src，且每次改 src 都要从头播（这是新歌）
let currentAudioUrl = ''
let loadTimeoutId = null
function clearLoadTimeout() {
  if (loadTimeoutId) { clearTimeout(loadTimeoutId); loadTimeoutId = null }
}

watch(() => playerStore.currentUrl, async (url) => {
  const audio = audioEl.value
  if (!audio) return
  if (!url) {
    // 切歌间隙或失败：暂停
    try { audio.pause() } catch {}
    audio.removeAttribute('src')
    currentAudioUrl = ''
    return
  }
  if (url === currentAudioUrl) return  // 同样的 URL：不动（防止 mid-playback 重置）
  currentAudioUrl = url
  clearLoadTimeout()
  // 10s 加载超时（防止某些源拿到 URL 但资源卡死）
  loadTimeoutId = setTimeout(() => {
    if (!audioEl.value) return
    if (audioEl.value.readyState < 1 && playerStore.currentUrl === url) {
      playerStore.isPlaying = false
      playerStore.playError = '播放加载超时，请稍后重试或切换音源'
    }
  }, 10000)
  // 设置 src 并从头播
  try {
    audio.src = url
    audio.currentTime = 0
    await audio.play()
  } catch (e) {
    // 自动播放被浏览器阻止（罕见，因为通常在用户手势后调用）或解码失败
    // 不在此处设 playError——error 事件会处理
  }
})

// 播放成功 4s 后自动清除旧错误信息
let errorAutoClear = null
watch(() => playerStore.playError, (msg) => {
  if (errorAutoClear) { clearTimeout(errorAutoClear); errorAutoClear = null }
  if (msg && playerStore.isPlaying) {
    errorAutoClear = setTimeout(() => { playerStore.playError = '' }, 4000)
  }
})

watch(() => playerStore.currentSong, async (song) => {
  coverUrl.value = ''
  if (!song) return
  const sid = song.source || 'wy'
  try {
    const pic = await api.pic(sid, song)
    if (pic) coverUrl.value = pic
  } catch (e) { /* no cover — silent */ }
}, { immediate: true })

onBeforeUnmount(() => {
  clearLoadTimeout()
  try { audioEl.value?.pause() } catch {}
  window.removeEventListener('pointermove', onWinSwipeMove)
  window.removeEventListener('pointerup', onWinSwipeEnd)
  window.removeEventListener('pointercancel', onWinSwipeEnd)
})

window.addEventListener('pointermove', onWinSwipeMove)
window.addEventListener('pointerup', onWinSwipeEnd)
window.addEventListener('pointercancel', onWinSwipeEnd)
</script>

<style scoped>
.player-error {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--danger, #e5484d);
  color: #fff;
  padding: 8px 12px 8px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  z-index: 50;
  box-shadow: var(--shadow-md);
  max-width: 80vw;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: player-error-slide 0.3s var(--ease-out);
}

.player-error-close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 6px;
  border-radius: var(--radius-xs);
  line-height: 1;
  flex-shrink: 0;
}

.player-error-close:hover {
  background: rgba(0, 0, 0, 0.2);
  color: #fff;
}

@keyframes player-error-slide {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
</style>
