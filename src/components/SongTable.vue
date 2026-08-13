<template>
  <table class="song-table" data-testid="song-list">
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>歌曲</th>
        <th>歌手</th>
        <th>专辑</th>
        <th style="width:64px">时长</th>
        <th style="width:52px">来源</th>
        <th style="width:80px"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(song, index) in songs" :key="songKey(song, index)"
          :class="{ playing: isCurrentSong(song) }"
          @dblclick="$emit('play', index)">
        <td class="song-index">{{ index + 1 }}</td>
        <td>{{ song.name || '未知' }}</td>
        <td>{{ song.singer || '未知' }}</td>
        <td>{{ song.albumName || '' }}</td>
        <td style="font-family:var(--font-mono);font-size:var(--font-size-xs);color:var(--text-tertiary)">
          {{ formatDuration(song.duration ?? song.interval) }}
        </td>
        <td><span class="song-source-tag">{{ song.source }}</span></td>
        <td class="actions">
          <button @click.stop="$emit('play', index)" title="播放">▶</button>
          <button v-if="showFav" class="fav-btn" :class="{ faved: isFav(song) }"
                  @click.stop="$emit('fav', song)" :title="isFav(song) ? '取消收藏' : '收藏'">
            {{ isFav(song) ? '♥' : '♡' }}
          </button>
          <button @click.stop="$emit('download', song)" title="下载">↓</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { usePlayerStore, useAppStore } from '../stores'

defineProps({
  songs: { type: Array, default: () => [] },
  showFav: { type: Boolean, default: false },
})

defineEmits(['play', 'fav', 'download'])

const playerStore = usePlayerStore()
const appStore = useAppStore()

function isFav(song) {
  if (!song) return false
  const fav = appStore.userLists.find(l => l.id === 'favorites')
  return !!fav?.songs.some(s =>
    (s.id && song.id && s.source && song.source)
      ? (s.id === song.id && s.source === song.source)
      : (s.name === song.name && s.singer === song.singer)
  )
}

function songKey(song, index) {
  return (song.id || `${song.name}_${index}`) + '_' + index
}

function isCurrentSong(song) {
  const cur = playerStore.currentSong
  if (!cur) return false
  if (song.id && cur.id && song.source && cur.source) {
    return song.id === cur.id && song.source === cur.source
  }
  return cur.name === song.name && cur.singer === song.singer
}

function formatDuration(d) {
  if (!d) return '--:--'
  if (typeof d === 'string' && d.includes(':')) return d
  const s = Number(d)
  if (isNaN(s) || !isFinite(s)) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m + ':' + (sec < 10 ? '0' : '') + sec
}
</script>