// 内置源播放/歌词/封面实现 —— 从 server/runtime/builtin-lists-wytx.cjs 与
// server/runtime/builtin-lists-kwkgmg.cjs 移植为浏览器/Tauri 通用版本。
// 这样播放不依赖第三方脚本（非常刀/星海）的 API key 失效问题。
import { httpGet, httpPostForm, httpPostJson } from './http.js'
import { eapi, zzcSign, mgSignature } from './crypto.js'
// 仅用 toMD5 / eapi / zzcSign / mgSignature；下面这些工具在本文件中暂未直接使用
// import { sizeFormate, formatPlayTime, decodeName, formatSingerName } from './utils.js'
import { sizeFormate, formatPlayTime, decodeName, formatSingerName } from './utils.js'

// ============================================================================
// WY (网易云音乐)
// ============================================================================
const WY_EAPI_URL = 'http://interface.music.163.com/eapi/batch'
const WY_LEVEL = {
  '128k': 'standard',
  '192k': 'higher',
  '320k': 'exhigh',
  'flac': 'lossless',
  'flac24bit': 'hires',
  'hires': 'hires',
  'jymaster': 'jymaster',
  'sky': 'sky',
  'jyeffect': 'jyeffect',
}
const WY_LEVEL_FALLBACK = {
  jymaster: ['jymaster', 'sky', 'hires', 'lossless', 'exhigh', 'standard'],
  sky: ['sky', 'hires', 'lossless', 'exhigh', 'standard'],
  jyeffect: ['jyeffect', 'lossless', 'exhigh', 'standard'],
  hires: ['hires', 'lossless', 'exhigh', 'standard'],
  lossless: ['lossless', 'exhigh', 'standard'],
  exhigh: ['exhigh', 'standard'],
  higher: ['higher', 'standard'],
  standard: ['standard'],
}

async function wyGetUrl(musicInfo, quality) {
  const id = musicInfo.songmid || musicInfo.id || musicInfo.meta?.songId
  if (!id) throw new Error('缺少歌曲ID')
  const level = WY_LEVEL[quality] || 'standard'
  const levels = WY_LEVEL_FALLBACK[level] || ['standard']

  // 直接走 eapi（避开 weapi 加密的 RSA 实现）
  for (const lv of levels) {
    try {
      const body = await httpPostForm(WY_EAPI_URL, eapi('/api/song/enhance/player/url/v1', {
        ids: [String(id)],
        level: lv,
        encodeType: 'flac',
        immerse: 0,
      }), {
        origin: 'https://music.163.com',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      })
      const data = body?.data?.[0] || body?.song?.[0]
      if (data && data.url && data.code === 200) {
        return { url: data.url, br: data.br, size: data.size }
      }
    } catch (e) { /* try next level */ }
  }
  throw new Error('网易云播放地址获取失败')
}

async function wyGetLyric(musicInfo) {
  const id = musicInfo.songmid || musicInfo.id || musicInfo.meta?.songId
  if (!id) throw new Error('缺少歌曲ID')
  const body = await httpPostForm(WY_EAPI_URL, eapi('/api/song/lyric/v1', {
    id: String(id),
    tv: 0,
    lv: 0,
    kv: 0,
    rv: 0,
    yv: 0,
    showLyric: 1,
  }), {
    origin: 'https://music.163.com',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
  })
  const lyric = body?.lrc?.lyric || body?.lyric
  if (!lyric) throw new Error('无歌词')
  return {
    lyric,
    tlyric: body?.tlyric?.lyric || '',
  }
}

function wyGetPic(musicInfo) {
  if (musicInfo.img) return Promise.resolve(musicInfo.img)
  const id = musicInfo.albumId || musicInfo.meta?.albumId
  if (!id) return Promise.resolve(null)
  return Promise.resolve(`https://p3.music.126.net/M8dK2Fc-q7R8s0T0e6j9eA=/${id}.jpg`)
    || httpGet(`https://music.163.com/api/album/${id}`).then(d => d?.album?.picUrl || d?.picUrl || null).catch(() => null)
}

// ============================================================================
// TX (QQ 音乐)
// ============================================================================
const buildTxComm = () => ({
  ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic', phonetype: 'EBG-AN10',
  deviceScore: '553.47', devicelevel: '50', newdevicelevel: '20',
  rom: 'HuaWei/EMOTION/EmotionUI_14.2.0', os_ver: '12', OpenUDID: '0', OpenUDID2: '0',
  QIMEI36: '0', udid: '0', chid: '0', aid: '0', oaid: '0', taid: '0', tid: '0', wid: '0',
  uid: '0', sid: '0', modeSwitch: '6', teenMode: '0', ui_mode: '2', nettype: '1020', v4ip: '',
})

const TX_FILE_INFO = {
  '128k': { s: 'M500', e: '.mp3', bitrate: 128 },
  '192k': { s: 'M500', e: '.mp3', bitrate: 192 },
  '320k': { s: 'M800', e: '.mp3', bitrate: 320 },
  flac: { s: 'F000', e: '.flac', bitrate: 999 },
  flac24bit: { s: 'RS01', e: '.flac', bitrate: 999 },
  hires: { s: 'RS01', e: '.flac', bitrate: 999 },
  master: { s: 'AI00', e: '.flac', bitrate: 999 },
}

async function txGetUrl(musicInfo, quality) {
  const songmid = musicInfo.songmid || musicInfo.id
  const strMediaMid = musicInfo.strMediaMid || musicInfo.meta?.strMediaMid
  if (!songmid || !strMediaMid) throw new Error('缺少QQ歌曲ID')
  const fileInfo = TX_FILE_INFO[quality] || TX_FILE_INFO['128k']
  const file = `${fileInfo.s}${strMediaMid}${fileInfo.e}`
  const guid = Math.random().toString().slice(2, 14).padEnd(13, '0')

  // 1) 拿 vkey
  const reqBody = {
    comm: buildTxComm(),
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: { guid, songmid: [songmid], songtype: [0], uin: '0', loginflag: 1, platform: '20', filename: [file] },
    },
  }
  try {
    const sign = zzcSign(JSON.stringify(reqBody))
    const resp = await httpPostJson(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`, reqBody, {
      'User-Agent': 'QQMusic 14090508(android 12)',
    })
    const midInfo = resp?.req_0?.data?.midurlinfo?.[0]
    if (midInfo?.purl) {
      return `https://isure.stream.qqmusic.qq.com/${midInfo.purl}&guid=${guid}&vkey=&uin=0&fromtag=120042`
    }
    // result 104003 = 无版权/付费；result 0 但 purl 为空 = 同样不可播
    // 这里不抛"VIP"细节，由上层回退到第三方脚本（feichangdao/xinghai 可能有破解源）
  } catch (e) {
    // 网络/签名错误：继续抛，让上层回退
    throw e
  }
  throw new Error('QQ 音乐免费接口未返回播放地址')
}

async function txGetLyric(musicInfo) {
  const songmid = musicInfo.songmid || musicInfo.id
  if (!songmid) throw new Error('缺少QQ歌曲ID')
  const body = await httpGet(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0&songmid=${songmid}`, {
    Referer: 'https://y.qq.com/',
    'User-Agent': 'QQMusic 14090508(android 12)',
  })
  const lyric = body?.lyric
  if (!lyric) throw new Error('无歌词')
  return { lyric, tlyric: body?.trans || '' }
}

function txGetPic(musicInfo) {
  if (musicInfo.img) return Promise.resolve(musicInfo.img)
  const albumMid = musicInfo.albumMid || musicInfo.meta?.albumMid
  if (!albumMid) return Promise.resolve(null)
  return Promise.resolve(`https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`)
}

// ============================================================================// KW (酷我音乐)
// ============================================================================
const KW_BR_MAP = { '128k': '128kmp3', '192k': '192kmp3', '320k': '320kmp3', flac: '2000kflac', flac24bit: '4000kflac', hires: '4000kflac', master: '4000kflac' }

async function kwGetUrl(musicInfo, quality) {
  const id = musicInfo.songmid || musicInfo.id
  if (!id) throw new Error('缺少KW歌曲ID')
  const br = KW_BR_MAP[quality] || '128kmp3'
  const body = await httpGet(`http://www.kuwo.cn/api/v1/www/music/playUrl?mid=${id}&type=convert_url&br=${br}`, {
    Referer: 'http://www.kuwo.cn/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  if (!body?.data?.url) throw new Error('酷我播放地址获取失败')
  return body.data.url
}

async function kwGetLyric(musicInfo) {
  const id = musicInfo.songmid || musicInfo.id
  if (!id) throw new Error('缺少KW歌曲ID')
  const body = await httpGet(`http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${id}&httpsStatus=1`, {
    Referer: 'http://m.kuwo.cn/',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
  })
  const lrcList = body?.data?.lrclist
  if (!Array.isArray(lrcList) || lrcList.length === 0) throw new Error('无歌词')
  const lyric = lrcList.map(l => {
    const time = (l.time || '00:00.00').replace('.', '.')
    return `[${time}]${l.lineLyric || ''}`
  }).join('\n')
  return { lyric, tlyric: '' }
}

function kwGetPic(musicInfo) {
  if (musicInfo.img) return Promise.resolve(musicInfo.img)
  return Promise.resolve(null)
}

// ============================================================================// KG (酷狗音乐)
// ============================================================================
const KG_BR_MAP = { '128k': '128', '320k': '320', flac: 'flac', flac24bit: 'high', hires: 'high', master: 'high' }

async function kgGetUrl(musicInfo, quality) {
  const hash = musicInfo.hash || musicInfo.meta?.hash
  const albumId = musicInfo.albumId || musicInfo.meta?.albumId
  if (!hash) throw new Error('缺少酷狗歌曲hash')
  const br = KG_BR_MAP[quality] || '128'
  const body = await httpGet(`https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${albumId || ''}&mid=&_=${Date.now()}`, {
    Referer: 'https://www.kugou.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const url = body?.data?.play_url || body?.data?.playurl
  if (!url) throw new Error('酷狗播放地址获取失败')
  // 自动选择最接近请求音质的回退
  return url
}

async function kgGetLyric(musicInfo) {
  const hash = musicInfo.hash || musicInfo.meta?.hash
  if (!hash) throw new Error('缺少酷狗歌曲hash')
  const body = await httpGet(`https://wwwapi.kugou.com/search/songsearch_cdn?ver=1&hash=${hash}&keyword=&platform=WebFilter&area_code=1`, {
    Referer: 'https://www.kugou.com/',
  })
  const id = body?.data?.[0]?.id
  if (!id) throw new Error('无歌词')
  const lrcBody = await httpGet(`https://wwwapi.kugou.com/apps/krc/getKrc.php?id=${id}&ver=2&charset=utf8&fmt=krc`, { Referer: 'https://www.kugou.com/' })
  // krc 转 lrc 简化（去掉 <...> 时间标签）
  if (typeof lrcBody === 'string') {
    const lyric = lrcBody.replace(/<\d+,\d+,\d+>/g, '').replace(/\[(\d+):(\d+)\.(\d+)\]/g, '[0$1:$2.$3]')
    return { lyric, tlyric: '' }
  }
  throw new Error('无歌词')
}

function kgGetPic(musicInfo) {
  if (musicInfo.img) return Promise.resolve(musicInfo.img)
  return Promise.resolve(null)
}

// ============================================================================// MG (咪咕音乐)
// ============================================================================
async function mgGetUrl(musicInfo, quality) {
  const copyrightId = musicInfo.copyrightId || musicInfo.meta?.copyrightId
  const songId = musicInfo.songmid || musicInfo.id
  if (!copyrightId && !songId) throw new Error('缺少咪咕歌曲ID')
  const id = copyrightId || songId
  const typeMap = { '128k': 'PQ', '320k': 'HQ', flac: 'SQ', flac24bit: 'ZQ', hires: 'ZQ', master: 'ZQ' }
  const audioType = typeMap[quality] || 'PQ'
  const time = Date.now().toString()
  const sig = mgSignature(time, 'HQ')
  const body = await httpGet(`https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/sub/resourceinfo.do?netType=01&resourceType=E0A&contentId=${id}&contentType=0010&toneFlag=P9&materialId=&userId=0&sessionId=0&copyrightId=${copyrightId || ''}&appId=0&ua=Android_migu&version=6.10.1&timestamp=${time}&sign=${sig.sign}&deviceId=${sig.deviceId}&channel=0146921&extParam=`, {
    uiVersion: 'A_music_3.6.1',
    deviceId: sig.deviceId,
    timestamp: time,
    sign: sig.sign,
    channel: '0146921',
    'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
  })
  const url = body?.data?.url
  if (!url) throw new Error('咪咕播放地址获取失败')
  return url
}

async function mgGetLyric(musicInfo) {
  const lrcUrl = musicInfo.lrcUrl || musicInfo.meta?.lrcUrl
  const copyrightId = musicInfo.copyrightId || musicInfo.meta?.copyrightId
  if (lrcUrl) {
    const body = await httpGet(lrcUrl, { Referer: 'https://music.migu.cn/' })
    if (typeof body === 'string' && body.includes('[')) return { lyric: body, tlyric: '' }
  }
  if (!copyrightId) throw new Error('无歌词')
  const body = await httpGet(`https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/lyric/lyricinfo.do?copyrightId=${copyrightId}&lyricType=1&resourceType=2&timestamp=${Date.now()}`)
  if (typeof body === 'string') return { lyric: body, tlyric: '' }
  throw new Error('无歌词')
}

function mgGetPic(musicInfo) {
  if (musicInfo.img) return Promise.resolve(musicInfo.img)
  return Promise.resolve(null)
}

// ============================================================================// 注册表
// ============================================================================
const playbackImpls = {
  wy: { getUrl: wyGetUrl, getLyric: wyGetLyric, getPic: wyGetPic },
  tx: { getUrl: txGetUrl, getLyric: txGetLyric, getPic: txGetPic },
  kw: { getUrl: kwGetUrl, getLyric: kwGetLyric, getPic: kwGetPic },
  kg: { getUrl: kgGetUrl, getLyric: kgGetLyric, getPic: kgGetPic },
  mg: { getUrl: mgGetUrl, getLyric: mgGetLyric, getPic: mgGetPic },
}

export const builtinGetMusicUrl = async (sourceId, musicInfo, quality) => {
  const impl = playbackImpls[sourceId]
  if (!impl?.getUrl) throw new Error(`内置源 ${sourceId} 不支持播放`)
  const result = await impl.getUrl(musicInfo, quality)
  // 兼容返回字符串或对象
  return typeof result === 'string' ? result : result?.url
}

export const builtinGetLyric = async (sourceId, musicInfo) => {
  const impl = playbackImpls[sourceId]
  if (!impl?.getLyric) throw new Error(`内置源 ${sourceId} 不支持歌词`)
  return await impl.getLyric(musicInfo)
}

export const builtinGetPic = async (sourceId, musicInfo) => {
  const impl = playbackImpls[sourceId]
  if (!impl?.getPic) return null
  try {
    return await impl.getPic(musicInfo)
  } catch {
    return null
  }
}
