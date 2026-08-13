<template>
  <div>
    <div class="content-header">
      <h1>下载</h1>
      <div class="status-bar">
        <span v-if="downloads.length">
          共 {{ downloads.length }} 个任务 · {{ doneCount }} 完成 · {{ errorCount }} 失败
        </span>
        <span v-else>暂无下载任务</span>
      </div>
    </div>

    <div class="content-body">
      <div v-if="!downloads.length" class="empty-state">
        <div class="empty-icon">↓</div>
        <div class="empty-title">暂无下载</div>
        <div class="empty-desc">在搜索、歌单或排行榜中点击下载按钮即可开始下载</div>
      </div>

      <table v-else class="song-table" data-testid="download-list">
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>歌曲</th>
            <th style="width:90px">音质</th>
            <th style="width:110px">状态</th>
            <th style="width:64px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in downloads" :key="i">
            <td class="song-index">{{ i + 1 }}</td>
            <td>
              <div class="dl-name">{{ d.name || '未知' }}</div>
              <div class="dl-artist">{{ d.singer || '' }}</div>
            </td>
            <td><span class="song-source-tag">{{ qualityLabel(d.quality) }}</span></td>
            <td>
              <span class="dl-status" :class="d.status">
                {{ statusLabel(d.status) }}
              </span>
            </td>
            <td class="actions">
              <button v-if="d.status === 'error'" @click="retry(d)" title="重试">↻</button>
              <button @click="remove(i)" title="移除">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '../stores'
import { openDownloadPicker } from '../downloads-ui'

const appStore = useAppStore()
const downloads = computed(() => appStore.downloads)

const doneCount = computed(() => downloads.value.filter(d => d.status === 'done').length)
const errorCount = computed(() => downloads.value.filter(d => d.status === 'error').length)

const QUALITY_LABELS = {
  '128k': '128K', '320k': '320K', flac: 'FLAC', flac24bit: '24Bit', hires: 'Hi-Res', master: 'Master',
}
const STATUS_LABELS = {
  pending: '等待中', downloading: '下载中', done: '已完成', error: '失败',
}

function qualityLabel(q) { return QUALITY_LABELS[q] || q || '-' }
function statusLabel(s) { return STATUS_LABELS[s] || s }

function remove(i) { appStore.removeDownload(i) }
function retry(d) { openDownloadPicker(d) }
</script>

<style scoped>
.dl-name { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-artist { color: var(--text-tertiary); font-size: var(--font-size-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-status { font-size: var(--font-size-xs); padding: 3px 8px; border-radius: 999px; }
.dl-status.pending { background: var(--bg-active); color: var(--text-secondary); }
.dl-status.downloading { background: rgba(18, 183, 106, 0.15); color: #2dd396; }
.dl-status.done { background: rgba(18, 183, 106, 0.15); color: #2dd396; }
.dl-status.error { background: rgba(229, 72, 77, 0.15); color: #ff7066; }
</style>