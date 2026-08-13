<template>
  <div>
    <div class="content-header">
      <h1>设置</h1>
    </div>

    <div class="content-body">
      <div class="settings-section">
        <h3>音源</h3>
        <div style="padding:8px 12px;margin-bottom:12px;background:var(--accent-subtle);border:1px solid var(--accent);border-radius:var(--radius-sm);font-size:var(--font-size-xs);color:var(--text-secondary);line-height:1.6">
          <strong>遇到播放问题？</strong> 内置音源仅支持免费歌曲。<br>
          其它内容需导入活跃的落雪音源脚本。<br>
        </div>
        <div class="theme-grid">
          <div v-for="t in themes" :key="t.id" class="theme-card"
               :class="{ active: currentTheme === t.id }" @click="setTheme(t.id)">
            <div class="theme-swatch" :style="{ background: t.bg }">
              <div class="theme-swatch-inner">
                <div class="theme-swatch-top" :style="{ background: t.surface }"></div>
                <div class="theme-swatch-bottom" :style="{ background: t.accent }"></div>
              </div>
            </div>
            <div>
              <div class="theme-name">{{ t.name }}</div>
              <div class="theme-desc">{{ t.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>音源</h3>
        <div class="settings-row">
          <div class="settings-label">
            已加载音源
            <small>{{ appStore.sources.length }} 个音源可用 · 搜索会从所有源同时聚合</small>
          </div>
          <div class="settings-value">
            <span style="font-size:var(--font-size-xs);color:var(--text-tertiary);font-family:var(--font-mono)">
              {{ appStore.sources.map(s => s.name + ' (' + s.id + ')').join('、') || '（空）' }}
            </span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label">
            从网址导入音源
            <small>输入 lx-music 格式 .js 音源直链，如 raw.githubusercontent.com</small>
          </div>
          <div class="settings-value" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="text" v-model="importUrl" placeholder="https://example.com/source.js"
                   data-testid="import-url"
                   style="flex:1;min-width:220px;padding:5px 10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);color:var(--text-primary);font-size:var(--font-size-sm);font-family:var(--font-mono)" />
            <button @click="importFromUrl" :disabled="isImportingUrl" data-testid="import-url-btn"
                    style="padding:5px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);color:var(--text-secondary);font-size:var(--font-size-sm);font-family:var(--font-body);cursor:pointer">
              {{ isImportingUrl ? '导入中...' : '导入' }}
            </button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label">
            导入自定义音源
            <small>支持 lx-music 格式的 .js 音源文件</small>
          </div>
          <div class="settings-value">
            <input type="file" accept=".js" @change="importSource" ref="fileInput"
                   style="display:none" data-testid="import-source" />
            <button @click="$refs.fileInput.click()"
                    style="padding:5px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-xs);color:var(--text-secondary);font-size:var(--font-size-sm);font-family:var(--font-body);cursor:pointer">
              选择文件
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>播放</h3>
        <div class="settings-row">
          <div class="settings-label">
            默认音质
            <small>播放时使用的音质</small>
          </div>
          <div class="settings-value">
            <select v-model="playerStore.quality" data-testid="settings-quality">
              <option value="128k">128K</option>
              <option value="320k">320K</option>
              <option value="flac">FLAC</option>
              <option value="flac24bit">24Bit</option>
            </select>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label">
            音量
            <small>调节播放音量</small>
          </div>
          <div class="settings-value" style="display:flex;align-items:center;gap:10px">
            <input type="range" min="0" max="1" step="0.05"
                   :value="playerStore.volume"
                   @input="playerStore.setVolume(parseFloat($event.target.value))"
                   style="width:120px" data-testid="settings-volume" />
            <span style="font-size:var(--font-size-xs);font-family:var(--font-mono);min-width:30px;color:var(--text-tertiary)">
              {{ Math.round(playerStore.volume * 100) }}%
            </span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>列表</h3>
        <div v-for="list in appStore.userLists" :key="list.id" class="settings-row">
          <div class="settings-label">
            {{ list.name }}
            <small>{{ list.songs.length }} 首歌曲</small>
          </div>
          <div class="settings-value" v-if="list.id !== 'default' && list.id !== 'favorites'">
            <button @click="appStore.deleteList(list.id)"
                    style="padding:3px 8px;background:transparent;border:1px solid var(--danger);border-radius:var(--radius-xs);color:var(--danger);font-size:var(--font-size-xs);font-family:var(--font-body);cursor:pointer">
              删除
            </button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>关于</h3>
        <div class="settings-row">
          <div class="settings-label">版本</div>
          <div class="settings-value">
            <span style="font-family:var(--font-mono);font-size:var(--font-size-xs);color:var(--text-tertiary)">Vaelen Music v1.0.0</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label">
            音源格式
            <small>兼容 lx-music 格式音源</small>
          </div>
          <div class="settings-value">
            <span style="font-size:var(--font-size-xs);color:var(--success)">✓ 已支持</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayerStore, useAppStore } from '../stores'
import { api } from '../api'

const playerStore = usePlayerStore()
const appStore = useAppStore()

const VALID_THEMES = ['midnight', 'neon', 'paper', 'aurora']
const themes = [
  { id: 'midnight', name: '午夜',      desc: '唯一深色 · 暗玻璃 + 温暖琥珀',   bg: '#0f1117', surface: '#171921', accent: '#e8a838' },
  { id: 'neon',     name: '霓虹',      desc: '浅色赛博 · 直角 + 网格 + 荧光蓝', bg: '#f4f6fb', surface: '#ffffff', accent: '#0090ff' },
  { id: 'paper',    name: '纸本',      desc: '暖纸米色 · 衬线标题 + 超圆角',   bg: '#f4ede0', surface: '#fcf8f0', accent: '#8b4f1f' },
  { id: 'aurora',   name: '极光',      desc: '浅色渐变 · 大圆角 + 磨玻璃',     bg: '#f2f5f7', surface: '#ffffff', accent: '#0ea5a4' },
]

const saved = localStorage.getItem('vaelen-theme')
const currentTheme = ref(VALID_THEMES.includes(saved) ? saved : 'midnight')
const importUrl = ref('')
const isImportingUrl = ref(false)

function setTheme(id) {
  if (!VALID_THEMES.includes(id)) id = 'midnight'
  currentTheme.value = id
  localStorage.setItem('vaelen-theme', id)
  document.documentElement.setAttribute('data-theme', id)
}

async function importFromUrl() {
  const url = importUrl.value.trim()
  if (!url) return alert('请输入音源网址')
  isImportingUrl.value = true
  try {
    const list = await api.importSourceFromUrl(url)
    await appStore.loadSources()
    alert('音源导入成功！已加载 ' + list.length + ' 个音源')
    importUrl.value = ''
  } catch (err) {
    alert('音源导入失败：' + ((err && err.message) || err || '未知错误'))
  } finally {
    isImportingUrl.value = false
  }
}

async function importSource(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const content = await file.text()
    const list = await api.importSource(content)
    await appStore.loadSources()
    alert('音源导入成功！已加载 ' + (list || appStore.sources).length + ' 个音源')
  } catch (err) {
    alert('音源导入失败：' + ((err && err.message) || err || '未知错误'))
  }
  e.target.value = ''
}
</script>
