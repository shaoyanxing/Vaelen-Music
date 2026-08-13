<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">♫</div>
        <div>
          <div class="brand-text">Vaelen Music</div>
          <div class="brand-sub">v1.0</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: $route.name === 'search' }">
          <span class="nav-icon">⌕</span>
          <span>搜索</span>
        </router-link>
        <router-link to="/lists" class="nav-item" :class="{ active: $route.name === 'lists' }">
          <span class="nav-icon">☰</span>
          <span>列表</span>
        </router-link>
        <router-link to="/songlists" class="nav-item" :class="{ active: $route.name === 'songlists' }">
          <span class="nav-icon">▤</span>
          <span>歌单</span>
        </router-link>
        <router-link to="/leaderboard" class="nav-item" :class="{ active: $route.name === 'leaderboard' }">
          <span class="nav-icon">♛</span>
          <span>排行榜</span>
        </router-link>
        <router-link to="/downloads" class="nav-item" :class="{ active: $route.name === 'downloads' }">
          <span class="nav-icon">↓</span>
          <span>下载</span>
        </router-link>
        <router-link to="/settings" class="nav-item" :class="{ active: $route.name === 'settings' }">
          <span class="nav-icon">⚙</span>
          <span>设置</span>
        </router-link>
      </nav>
      <div class="sidebar-source">
        <div class="sidebar-source-status">
          <span class="status-dot" :class="{ error: !appStore.sources.length }"></span>
          <span>{{ appStore.sources.length }} 个音源</span>
        </div>
        <div v-if="appStore.sourceError" class="sidebar-source-error" data-testid="source-error">
          {{ appStore.sourceError }}
        </div>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
    <PlayerBar />
    <NowPlaying />
    <QualityPicker />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAppStore, usePlayerStore } from './stores'
import PlayerBar from './components/PlayerBar.vue'
import NowPlaying from './components/NowPlaying.vue'
import QualityPicker from './components/QualityPicker.vue'

const appStore = useAppStore()
const playerStore = usePlayerStore()
const VALID_THEMES = ['midnight', 'neon', 'paper', 'aurora']
onMounted(() => {
  const saved = localStorage.getItem('vaelen-theme')
  const theme = VALID_THEMES.includes(saved) ? saved : 'midnight'
  if (!VALID_THEMES.includes(saved)) localStorage.setItem('vaelen-theme', theme)
  document.documentElement.setAttribute('data-theme', theme)
  appStore.restoreData()
  appStore.loadSources()
})
</script>
