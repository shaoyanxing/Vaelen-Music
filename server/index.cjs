const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const LxRuntime = require('./runtime/lx-runtime.cjs');
const { builtinSearch, isBuiltinSource, toNewSongInfo } = require('./runtime/builtin-sdk.cjs');
const { builtinGetMusicUrl, builtinGetLyric, builtinGetPic } = require('./runtime/builtin-playback.cjs');
const lists = Object.assign(
  {},
  require('./runtime/builtin-lists-wytx.cjs').PLATFORMS,
  require('./runtime/builtin-lists-kwkgmg.cjs').PLATFORMS
);

const app = express();
const PORT = process.env.PORT || 3210;
const runtime = new LxRuntime();

app.use(express.json());

// Auto-load sources from sources/ directory
const sourcesDir = path.join(__dirname, '..', 'sources');
if (fs.existsSync(sourcesDir)) {
  const files = fs.readdirSync(sourcesDir).filter(f => f.endsWith('.js'));
  files.forEach(async (file) => {
    try {
      const content = fs.readFileSync(path.join(sourcesDir, file), 'utf8');
      await runtime.loadSource(content);
      console.log('[Source] Loaded: ' + file);
    } catch (err) {
      console.error('[Source] Failed to load ' + file + ':', err.message);
    }
  });
}

// Serve static files from dist in production
app.use(express.static(path.join(__dirname, '..', 'dist')));

// API Routes
app.get('/api/sources', async (req, res) => {
  try {
    const sources = await runtime.getSourceList();
    res.json({ success: true, sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sources/load', async (req, res) => {
  try {
    const { scriptContent } = req.body;
    const result = await runtime.loadSource(scriptContent);
    const sources = await runtime.getSourceList();
    res.json({ success: true, sources, init: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { sourceId, keyword, page } = req.body;
    let result;
    if (isBuiltinSource(sourceId)) {
      // 内置源搜索在服务端执行，避免浏览器 CORS 拦截
      result = await builtinSearch(sourceId, keyword, page || 1);
    } else {
      result = await runtime.search(sourceId, keyword, page);
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/music-url', async (req, res) => {
  try {
    const { sourceId, musicInfo, quality } = req.body;
    // 内置源优先（不依赖第三方脚本的 API key 失效问题）
    if (isBuiltinSource(sourceId) && builtinGetMusicUrl) {
      try {
        const url = await builtinGetMusicUrl(sourceId, musicInfo, quality)
        if (url) return res.json({ success: true, url })
      } catch (e) {
        console.warn(`[server builtin ${sourceId} musicUrl] 失败，回退到 runtime:`, e.message)
      }
    }
    const url = await runtime.getMusicUrl(sourceId, musicInfo, quality);
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/lyric', async (req, res) => {
  try {
    const { sourceId, musicInfo } = req.body;
    if (isBuiltinSource(sourceId) && builtinGetLyric) {
      try {
        const lyric = await builtinGetLyric(sourceId, musicInfo)
        if (lyric) return res.json({ success: true, data: lyric })
      } catch (e) {
        console.warn(`[server builtin ${sourceId} lyric] 失败:`, e.message)
      }
    }
    const lyric = await runtime.getLyric(sourceId, musicInfo);
    res.json({ success: true, data: lyric });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/pic', async (req, res) => {
  try {
    const { sourceId, musicInfo } = req.body;
    if (isBuiltinSource(sourceId) && builtinGetPic) {
      try {
        const pic = await builtinGetPic(sourceId, musicInfo)
        if (pic) return res.json({ success: true, url: pic })
      } catch (e) { /* 静默 */ }
    }
    const pic = await runtime.getPic(sourceId, musicInfo);
    res.json({ success: true, url: pic });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 歌单：分类列表 + 详情
app.get('/api/songlists', async (req, res) => {
  try {
    const { source, type = 'all', page = 1, limit = 30 } = req.query;
    const p = lists[source];
    let data;
    if (p && p.songList) {
      data = await p.songList.getLists(String(type), parseInt(page) || 1, parseInt(limit) || 30);
    } else {
      // 用户导入的 lx 脚本音源
      data = await runtime.songLists(source, String(type), parseInt(page) || 1, parseInt(limit) || 30);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/songlist', async (req, res) => {
  try {
    const { source, id, page = 1, limit = 50 } = req.query;
    const p = lists[source];
    let data;
    if (p && p.songList) {
      data = await p.songList.getList(String(id), parseInt(page) || 1, parseInt(limit) || 50);
    } else {
      data = await runtime.songList(source, String(id), parseInt(page) || 1, parseInt(limit) || 50);
    }
    if (Array.isArray(data.list)) {
      data.list = data.list.filter(Boolean).map(toNewSongInfo);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 排行榜：榜单列表 + 详情
app.get('/api/leaderboards', async (req, res) => {
  try {
    const { source } = req.query;
    const p = lists[source];
    let data;
    if (p && p.leaderboard) {
      data = await p.leaderboard.getLists();
    } else {
      data = await runtime.leaderboards(source);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const { source, id, page = 1, limit = 100 } = req.query;
    const p = lists[source];
    let data;
    if (p && p.leaderboard) {
      data = await p.leaderboard.getList(String(id), parseInt(page) || 1, parseInt(limit) || 100);
    } else {
      data = await runtime.leaderboard(source, String(id), parseInt(page) || 1, parseInt(limit) || 100);
    }
    if (Array.isArray(data.list)) {
      data.list = data.list.filter(Boolean).map(toNewSongInfo);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 下载代理：Web 模式下经同源服务端下载，绕开 CORS 与混合内容限制
app.get('/api/download', (req, res) => {
  const { url, filename } = req.query;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ success: false, error: '无效的下载地址' });
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    return res.status(400).json({ success: false, error: '无效的下载地址' });
  }
  const proto = parsedUrl.protocol === 'https:' ? https : http;
  const downloadReq = proto.get({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.pathname + parsedUrl.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: url,
    },
    timeout: 20000,
  }, (resp) => {
    if (resp.statusCode >= 400) {
      res.status(502).json({ success: false, error: '下载失败: HTTP ' + resp.statusCode });
      return;
    }
    try {
      res.attachment(decodeURIComponent(filename || 'music') + '.mp3');
    } catch (e) {
      res.attachment('music.mp3');
    }
    res.setHeader('Content-Type', resp.headers['content-type'] || 'application/octet-stream');
    if (resp.headers['content-length']) res.setHeader('Content-Length', resp.headers['content-length']);
    if (resp.headers['content-encoding']) res.setHeader('Content-Encoding', resp.headers['content-encoding']);
    resp.pipe(res);
  });
  downloadReq.on('error', (err) => {
    res.status(502).json({ success: false, error: '下载失败: ' + err.message });
  });
  downloadReq.on('timeout', () => {
    downloadReq.destroy(new Error('下载超时'));
  });
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Build the frontend first: npm run build');
  }
});

const server = app.listen(PORT, () => {
  console.log(`Vaelen Music server running on http://localhost:${PORT}`);
});

module.exports = { app, server, runtime };
