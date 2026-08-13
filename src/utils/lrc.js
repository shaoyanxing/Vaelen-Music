// LRC 歌词解析
// 解析 LRC 格式：返回 { meta, lines } —— meta 包含 [ti:歌名][ar:歌手][al:专辑][by:制作][offset:偏移] 等，
// lines 为 [{ time, text }] 时间升序数组。
// 同时剥离「作词：xxx」「作曲：xxx」「编曲：xxx」等纯文本元数据行（出现在某些歌曲里，不带时间戳）
//
// 也支持网易云 eapi 返回的 JSON 格式：{ t, c: [{ tx, li?, si? }] }
// t 为起始时间（秒），c 为分词片段数组（每片一个 tx，可能带 li 链接或 si 时间偏移）
// 我们会把分片拼成完整行，并把 c 中每个片段按其 si（毫秒）偏移分配时间点

const META_KEYS = ['ti', 'ar', 'al', 'by', 'offset', 'length', 'au', 're', 've', 'karaoke']
const PURE_META_PREFIXES = ['作词', '作曲', '编曲', '制作', '出品', '录音', '混音', '母带', '统筹', '监制', '策划', '发行', '词', '曲', 'OP', 'SP', 'Copyright']

function isWyJsonLyric(raw) {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
  try {
    const obj = JSON.parse(trimmed)
    return obj && typeof obj === 'object' && Array.isArray(obj.c) && typeof obj.t === 'number'
  } catch { return false }
}

function parseWyJsonLyric(raw) {
  // raw: '{"t":12.34,"c":[{"tx":"hi","si":0},{"tx":" world","si":1500}]}'
  // 转换为 lines：{ time, text } 数组，time 为该行第一个分片的起始时间
  // 同时把同一行的所有 tx 拼成完整 text
  let obj
  try { obj = JSON.parse(raw) } catch { return { meta: {}, lines: [] } }
  const lines = []
  for (const seg of obj.c || []) {
    if (!seg || !Array.isArray(seg.c)) continue
    const text = seg.c.map(p => p?.tx || '').join('').trim()
    if (!text) continue
    if (PURE_META_PREFIXES.some(p => text.startsWith(p) || text.startsWith(p + '：') || text.startsWith(p + ':'))) continue
    const t = (seg.t || 0) + (seg.i || 0) / 1000
    lines.push({ time: t, text })
  }
  lines.sort((a, b) => a.time - b.time)
  return { meta: {}, lines }
}

export function parseLrc(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return { meta: {}, lines: [] }
  // 网易云 JSON 歌词
  if (isWyJsonLyric(lrcText)) {
    return parseWyJsonLyric(lrcText)
  }
  const meta = {}
  const lines = []
  const metaRe = /^\[([a-zA-Z]+):(.*)\]$/

  for (const rawLine of lrcText.split(/\r?\n/)) {
    const line = rawLine.replace(/^﻿/, '').trim()
    if (!line) continue

    // 整行元数据： [ti:歌名]
    const metaMatch = line.match(metaRe)
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase()
      if (META_KEYS.includes(key)) {
        meta[key] = metaMatch[2].trim()
        continue
      }
    }

    // 多时间戳歌词行：[00:01.00][00:31.00]歌词文本
    const ts = []
    let rest = line
    let m
    while ((m = rest.match(/^\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]\s*/))) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0
      ts.push(min * 60 + sec + ms / 1000)
      rest = rest.slice(m[0].length)
    }
    if (ts.length === 0) continue
    const text = rest.trim()
    if (PURE_META_PREFIXES.some(p => text.startsWith(p) || text.startsWith(p + '：') || text.startsWith(p + ':'))) continue
    for (const t of ts) lines.push({ time: t, text })
  }
  lines.sort((a, b) => a.time - b.time)
  return { meta, lines }
}

// 在 lines 数组中查找 currentTime 所在/前一行索引
export function findLyricIndex(lines, currentTime) {
  if (!lines || !lines.length) return -1
  let lo = 0, hi = lines.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= currentTime) { ans = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return ans
}

export function formatLrcTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
