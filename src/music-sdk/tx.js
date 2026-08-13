import { zzcSign } from './crypto.js'
import { httpPostJson } from './http.js'
import { sizeFormate, formatPlayTime, formatSingerName } from './utils.js'

const limit = 50

const buildComm = () => ({
  ct: '11',
  cv: '14090508',
  v: '14090508',
  tmeAppID: 'qqmusic',
  phonetype: 'EBG-AN10',
  deviceScore: '553.47',
  devicelevel: '50',
  newdevicelevel: '20',
  rom: 'HuaWei/EMOTION/EmotionUI_14.2.0',
  os_ver: '12',
  OpenUDID: '0',
  OpenUDID2: '0',
  QIMEI36: '0',
  udid: '0',
  chid: '0',
  aid: '0',
  oaid: '0',
  taid: '0',
  tid: '0',
  wid: '0',
  uid: '0',
  sid: '0',
  modeSwitch: '6',
  teenMode: '0',
  ui_mode: '2',
  nettype: '1020',
  v4ip: '',
})

const buildReq = (str, page, limit) => ({
  comm: buildComm(),
  req: {
    module: 'music.search.SearchCgiService',
    method: 'DoSearchForQQMusicMobile',
    param: {
      search_type: 0,
      searchid: Math.random().toString().slice(2),
      query: str,
      page_num: page,
      num_per_page: limit,
      highlight: 0,
      nqc_flag: 0,
      multi_zhida: 0,
      cat: 2,
      grp: 1,
      sin: 0,
      sem: 0,
    },
  },
})

const musicSearch = async (str, page, limit, retryNum = 0) => {
  const data = buildReq(str, page, limit)
  const sign = zzcSign(JSON.stringify(data))
  const body = await httpPostJson(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`, data, {
    'User-Agent': 'QQMusic 14090508(android 12)',
  })
  if (!body || !body.req || body.code != 0 || body.req.code != 0) {
    if (retryNum > 5) throw new Error('QQ音乐搜索失败')
    return musicSearch(str, page, limit, ++retryNum)
  }
  return body.req.data
}

export const txSearch = async (str, page = 1) => {
  const data = await musicSearch(str, page, limit)
  const rawList = data?.body?.item_song || []
  const list = rawList.map(mapTxItem).filter(Boolean)
  const total = data?.meta?.estimate_sum || 0
  return {
    list,
    allPage: Math.ceil(total / limit),
    total,
    limit,
    source: 'tx',
  }
}

const mapTxItem = item => {
  if (!item.file?.media_mid) return null

  let types = []
  let _types = {}
  const file = item.file
  if (file.size_128mp3 != 0) {
    let size = sizeFormate(file.size_128mp3)
    types.push({ type: '128k', size })
    _types['128k'] = { size }
  }
  if (file.size_320mp3 !== 0) {
    let size = sizeFormate(file.size_320mp3)
    types.push({ type: '320k', size })
    _types['320k'] = { size }
  }
  if (file.size_flac !== 0) {
    let size = sizeFormate(file.size_flac)
    types.push({ type: 'flac', size })
    _types.flac = { size }
  }
  if (file.size_hires !== 0) {
    let size = sizeFormate(file.size_hires)
    types.push({ type: 'flac24bit', size })
    _types.flac24bit = { size }
  }
  let albumId = ''
  let albumName = ''
  if (item.album) {
    albumName = item.album.name
    albumId = item.album.mid
  }
  return {
    singer: formatSingerName(item.singer, 'name'),
    name: item.title,
    albumName,
    albumId,
    source: 'tx',
    interval: formatPlayTime(item.interval),
    duration: item.interval || 0,
    songId: String(item.id),
    albumMid: item.album?.mid ?? '',
    strMediaMid: item.file.media_mid,
    songmid: item.mid,
    id: item.mid,
    img: (albumId === '' || albumId === '空')
      ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
      : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
    types,
    _types,
    typeUrl: {},
  }
}