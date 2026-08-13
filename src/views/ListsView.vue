<template>
  <div>
    <div class="content-header">
      <h1>列表</h1>
      <div class="lists-header">
        <button @click="createList" data-testid="create-list-btn">+ 新建</button>
      </div>
    </div>

    <div class="content-body">
      <div class="list-tabs" data-testid="list-tabs">
        <button v-for="list in appStore.userLists" :key="list.id"
                class="list-tab" :class="{ active: activeListId === list.id }"
                @click="activeListId = list.id">
          {{ list.name }} <span style="opacity:0.5;margin-left:4px">{{ list.songs.length }}</span>
        </button>
      </div>

      <div v-if="currentList && currentList.songs.length > 0">
        <table class="song-table" data-testid="list-songs">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>歌曲</th>
              <th>歌手</th>
              <th>专辑</th>
              <th style="width:64px">时长</th>
              <th style="width:52px">来源</th>
              <th style="width:60px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(song, index) in currentList.songs" :key="index"
                :class="{ playing: isCurrentSong(song) }"
                @dblclick="playFromList(index)">
              <td class="song-index">{{ index + 1 }}</td>
              <td>{{ song.name || '未知' }}</td>
              <td>{{ song.singer || '未知' }}</td>
              <td>{{ song.albumName || '' }}</td>
              <td style="font-family:var(--font-mono);font-size:var(--font-size-xs);color:var(--text-tertiary)">
                {{ formatDuration(song.duration) }}
              </td>
              <td><span class="song-source-tag">{{ song.source || 'wy' }}</span></td>
              <td class="actions">
                <button @click.stop="playFromList(index)">▶</button>
                <button @click.stop="removeSong(index)" v-if="activeListId !== 'default'">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <div class="empty-icon">☰</div>
        <div class="empty-title">{{ currentList ? currentList.name + ' 是空的' : '选择一个列表' }}</div>
        <div class="empty-desc">从搜索结果中添加歌曲到这里</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePlayerStore, useAppStore } from '../stores'

const playerStore = usePlayerStore()
const appStore = useAppStore()
const activeListId = ref('default')

const currentList = computed(() => {
  return appStore.userLists.find(l => l.id === activeListId.value)
})

function playFromList(index) {
  if (!currentList.value) return
  playerStore.setPlaylist(currentList.value.songs)
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

function removeSong(index) {
  appStore.removeFromList(activeListId.value, index)
}

function createList() {
  const name = prompt('输入列表名称：')
  if (name && name.trim()) {
    appStore.createList(name.trim())
  }
}

function formatDuration(sec) {
  if (!sec) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}
</script>
