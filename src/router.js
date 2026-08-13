import { createRouter, createWebHistory } from 'vue-router'
import SearchView from './views/SearchView.vue'
import SongListView from './views/SongListView.vue'
import LeaderboardView from './views/LeaderboardView.vue'
import ListsView from './views/ListsView.vue'
import SettingsView from './views/SettingsView.vue'
import DownloadsView from './views/DownloadsView.vue'

const routes = [
  { path: '/', name: 'search', component: SearchView },
  { path: '/songlists', name: 'songlists', component: SongListView },
  { path: '/leaderboard', name: 'leaderboard', component: LeaderboardView },
  { path: '/lists', name: 'lists', component: ListsView },
  { path: '/downloads', name: 'downloads', component: DownloadsView },
  { path: '/settings', name: 'settings', component: SettingsView },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})