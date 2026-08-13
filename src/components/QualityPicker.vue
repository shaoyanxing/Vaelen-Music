<template>
  <teleport to="body">
    <transition name="qp-fade">
      <div v-if="visible" class="qp-mask" @click.self="cancel">
        <div class="qp-card" role="dialog" aria-label="选择下载音质">
          <div class="qp-title">选择音质下载</div>
          <div class="qp-sub">{{ songName }}</div>
          <div class="qp-options">
            <button v-for="q in qualities" :key="q.value" class="qp-option"
                    :class="{ active: q.value === defaultQuality }"
                    @click="choose(q.value)">
              {{ q.label }}
            </button>
          </div>
          <button class="qp-cancel" @click="cancel">取消</button>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAppStore, usePlayerStore } from '../stores'
import { pickerSong, clearDownloadPicker } from '../downloads-ui'

const appStore = useAppStore()
const playerStore = usePlayerStore()
const QUALITY_ORDER = ['128k', '320k', 'flac', 'flac24bit', 'hires', 'master']
const QUALITY_LABELS = {
  '128k': '128K', '320k': '320K', flac: 'FLAC', flac24bit: '24Bit', hires: 'Hi-Res', master: 'Master',
}

const visible = ref(false)
const song = ref(null)

const songName = computed(() => {
  const s = song.value
  if (!s) return ''
  return (s.name || '未知歌曲') + (s.singer ? ' - ' + s.singer : '')
})

const qualities = QUALITY_ORDER.map(v => ({ value: v, label: QUALITY_LABELS[v] }))
const defaultQuality = computed(() => playerStore.quality)

watch(pickerSong, (s) => {
  if (s) {
    song.value = s
    visible.value = true
  } else {
    visible.value = false
  }
})

function choose(q) {
  const s = song.value
  visible.value = false
  clearDownloadPicker()
  // 统一走 store：内部负责下载项状态、保存路径对话框、取消处理与持久化
  appStore.downloadSong(s, q).catch(() => {})
}

function cancel() {
  visible.value = false
  clearDownloadPicker()
}
</script>

<style scoped>
.qp-mask {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}
.qp-card {
  width: min(420px, 90vw);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
}
.qp-title {
  font-size: var(--font-size-lg); font-weight: 700; color: var(--text-primary);
}
.qp-sub {
  font-size: var(--font-size-sm); color: var(--text-secondary);
  margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.qp-options {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  margin-top: 18px;
}
.qp-option {
  padding: 12px 8px;
  background: var(--bg-active);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: var(--font-size-md); font-weight: 600;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: all 0.15s;
}
.qp-option:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-hover);
}
.qp-option.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-hover);
}
.qp-cancel {
  margin-top: 14px; width: 100%;
  padding: 10px;
  background: transparent; border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.qp-cancel:hover { color: var(--text-primary); background: var(--bg-active); }
.qp-fade-enter-active, .qp-fade-leave-active { transition: opacity 0.2s; }
.qp-fade-enter-from, .qp-fade-leave-to { opacity: 0; }
</style>