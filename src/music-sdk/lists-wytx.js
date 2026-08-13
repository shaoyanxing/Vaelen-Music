// lx-music-desktop 官方源码移植（浏览器 ESM 版）：
//   src/renderer/utils/musicSdk/wy/songList.js / wy/leaderboard.js / wy/musicDetail.js / wy/utils/*
//   src/renderer/utils/musicSdk/tx/songList.js / tx/leaderboard.js
// 翻译自 server/runtime/builtin-lists-wytx.cjs（已实网验证）；
// 请求层复用 ./http.js（lxRequest：Tauri Rust lx_request / 浏览器 fetch 双路径），
// 加密复用 ./crypto.js（eapi），其余补充 weapi/linuxapi/dateFormat/formatPlayCount/RSA(BigInt)。

import { lxRequest } from './http.js'
import { eapi } from './crypto.js'
import { sizeFormate, formatPlayTime, decodeName, formatSingerName, formatSinger } from './utils.js'
import CJS from './crypto-lib.js'

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// httpRequest 语义与服务端版一致：返回 { statusCode, headers, body }（见 http.js 的 lxRequest）
const httpRequest = (url, options = {}) => {
  const headers = { 'User-Agent': DEFAULT_UA, ...(options.headers || {}) }
  return lxRequest(url, { ...options, headers })
}

// ---------------- 补充工具（wy/utils/crypto.js 移植，仅本文件缺失部分） ----------------
const ivStr = '0102030405060708'
const presetKey = '0CoJUm6Qyw8W8jud'
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
// weapi 固定 RSA 公钥（1024bit，e=65537）；modulus 由公钥 PEM 解析得到，BigInt 实现 RSA_NO_PADDING
const RSA_N = BigInt('0x' + 'e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7')
const RSA_E = 0x10001n

const aesCbcEncryptBase64 = (text, key, iv) => CJS.AES.encrypt(
  CJS.enc.Utf8.parse(String(text)),
  CJS.enc.Utf8.parse(String(key)),
  { iv: CJS.enc.Utf8.parse(iv), mode: CJS.mode.CBC }
).toString()

const aes128EcbHex = (data, key) => CJS.AES.encrypt(
  CJS.enc.Utf8.parse(String(data)),
  CJS.enc.Utf8.parse(String(key)),
  { mode: CJS.mode.ECB }
).ciphertext.toString(CJS.enc.Hex).toUpperCase()

const getRandomBytesBase62 = size => {
  const arr = new Uint8Array(size)
  globalThis.crypto.getRandomValues(arr)
  return arr.map(n => base62.charCodeAt(n % 62))
}

const bytesToHex = bytes => {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

const powMod = (base, exp, mod) => {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    base = (base * base) % mod
    exp >>= 1n
  }
  return result
}

const rsaEncryptHex = buffer => {
  const padded = new Uint8Array(128)
  padded.set(buffer, 128 - buffer.length)
  return powMod(BigInt('0x' + bytesToHex(padded)), RSA_E, RSA_N).toString(16).padStart(256, '0')
}

const weapi = object => {
  const text = JSON.stringify(object)
  const secretKey = getRandomBytesBase62(16)
  return {
    params: aesCbcEncryptBase64(aesCbcEncryptBase64(text, presetKey, ivStr), String.fromCharCode(...secretKey), ivStr),
    encSecKey: rsaEncryptHex(secretKey.reverse()),
  }
}

const linuxapi = object => ({
  eparams: aes128EcbHex(JSON.stringify(object), 'rFgB&h#%2?^eDg:Q'),
})

// ---------------- 补充工具（@common/utils/common.ts / @renderer/utils 移植） ----------------
const numFix = n => n < 10 ? (`0${n}`) : n.toString()

const toDateObj = date => {
  // console.log(date)
  if (!date) return ''
  switch (typeof date) {
    case 'string':
      if (!date.includes('T')) date = date.split('.')[0].replace(/-/g, '/')
    // eslint-disable-next-line no-fallthrough
    case 'number':
      date = new Date(date)
    // eslint-disable-next-line no-fallthrough
    case 'object':
      break
    default: return ''
  }
  return date
}

const dateFormat = (_date, format = 'Y-M-D h:m:s') => {
  // console.log(date)
  const date = toDateObj(_date)
  if (!date) return ''
  return format
    .replace('Y', date.getFullYear().toString())
    .replace('M', numFix(date.getMonth() + 1))
    .replace('D', numFix(date.getDate()))
    .replace('h', numFix(date.getHours()))
    .replace('m', numFix(date.getMinutes()))
    .replace('s', numFix(date.getSeconds()))
}

const formatPlayCount = num => {
  if (num > 100000000) return `${Math.trunc(num / 10000000) / 10}亿`
  if (num > 10000) return `${Math.trunc(num / 1000) / 10}万`
  return String(num)
}

// ---------------- wy/utils/index.js 移植（eapiRequest） ----------------
const wyEapiRequest = (url, data) => {
  return httpRequest('http://interface.music.163.com/eapi/batch', {
    method: 'post',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      origin: 'https://music.163.com',
      // cookie: 'os=pc; deviceId=A9C064BB4584D038B1565B58CB05F95290998EE8B025AA2D07AE; osver=Microsoft-Windows-10-Home-China-build-19043-64bit; appver=2.5.2.197409; channel=netease; MUSIC_A=37a11f2eb9de9930cad479b2ad495b0e4c982367fb6f909d9a3f18f876c6b49faddb3081250c4980dd7e19d4bd9bf384e004602712cf2b2b8efaafaab164268a00b47359f85f22705cc95cb6180f3aee40f5be1ebf3148d888aa2d90636647d0c3061cd18d77b7a0; __csrf=05b50d54082694f945d7de75c210ef94; mode=Z7M-KP5(7)GZ; NMTID=00OZLp2VVgq9QdwokUgq3XNfOddQyIAAAF_6i8eJg; ntes_kaola_ad=1',
    },
    form: eapi(url, data),
  })
}

// ---------------- wy/musicDetail.js 移植 ----------------
const wyMusicDetail = {
  getSinger(singers) {
    let arr = []
    singers?.forEach(singer => {
      arr.push(singer.name)
    })
    return arr.join('、')
  },
  filterList({ songs, privileges }) {
    // console.log(songs, privileges)
    const list = []
    songs.forEach((item, index) => {
      const types = []
      const _types = {}
      let size
      let privilege = privileges[index]
      if (privilege.id !== item.id) privilege = privileges.find(p => p.id === item.id)
      if (!privilege) return

      if (privilege.maxBrLevel == 'hires') {
        size = item.hr ? sizeFormate(item.hr.size) : null
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = {
          size,
        }
      }
      switch (privilege.maxbr) {
        case 999000:
          size = item.sq ? sizeFormate(item.sq.size) : null
          types.push({ type: 'flac', size })
          _types.flac = {
            size,
          }
        // eslint-disable-next-line no-fallthrough
        case 320000:
          size = item.h ? sizeFormate(item.h.size) : null
          types.push({ type: '320k', size })
          _types['320k'] = {
            size,
          }
        // eslint-disable-next-line no-fallthrough
        case 192000:
        // eslint-disable-next-line no-fallthrough
        case 128000:
          size = item.l ? sizeFormate(item.l.size) : null
          types.push({ type: '128k', size })
          _types['128k'] = {
            size,
          }
      }

      types.reverse()

      if (item.pc) {
        list.push({
          singer: item.pc.ar ?? '',
          name: item.pc.sn ?? '',
          albumName: item.pc.alb ?? '',
          albumId: item.al?.id,
          source: 'wy',
          interval: formatPlayTime(item.dt / 1000),
          songmid: item.id,
          img: item.al?.picUrl ?? '',
          lrc: null,
          otherSource: null,
          types,
          _types,
          typeUrl: {},
        })
      } else {
        list.push({
          singer: this.getSinger(item.ar),
          name: item.name ?? '',
          albumName: item.al?.name,
          albumId: item.al?.id,
          source: 'wy',
          interval: formatPlayTime(item.dt / 1000),
          songmid: item.id,
          img: item.al?.picUrl,
          lrc: null,
          otherSource: null,
          types,
          _types,
          typeUrl: {},
        })
      }
    })
    // console.log(list)
    return list
  },
  async getList(ids = [], retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'))

    const requestObj = httpRequest('https://music.163.com/weapi/v3/song/detail', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
        origin: 'https://music.163.com',
      },
      form: weapi({
        c: '[' + ids.map(id => ('{"id":' + id + '}')).join(',') + ']',
        ids: '[' + ids.join(',') + ']',
      }),
    })
    const { body, statusCode } = await requestObj
    if (statusCode != 200 || body.code !== 200) throw new Error('获取歌曲详情失败')
    // console.log(body)
    return { source: 'wy', list: this.filterList(body) }
  },
}

// ---------------- wy/songList.js 移植 ----------------
const wySongList = {
  _requestObj_tags: null,
  _requestObj_hotTags: null,
  _requestObj_list: null,
  limit_list: 30,
  limit_song: 100000,
  successCode: 200,
  cookie: 'MUSIC_U=',
  sortList: [
    {
      name: '最热',
      id: 'hot',
    },
    // {
    //   name: '最新',
    //   id: 'new',
    // },
  ],
  regExps: {
    listDetailLink: /^.+(?:\?|&)id=(\d+)(?:&.*$|#.*$|$)/,
    listDetailLink2: /^.+\/playlist\/(\d+)\/\d+\/.+$/,
  },

  async handleParseId(link, retryNum = 0) {
    if (retryNum > 2) throw new Error('link try max num')

    const requestObj_listDetailLink = httpRequest(link)
    const { headers: { location }, statusCode } = await requestObj_listDetailLink
    // console.log(headers)
    if (statusCode > 400) return this.handleParseId(link, ++retryNum)
    const url = location == null ? link : location
    return this.regExps.listDetailLink.test(url)
      ? url.replace(this.regExps.listDetailLink, '$1')
      : url.replace(this.regExps.listDetailLink2, '$1')
  },

  async getListId(id) {
    let cookie
    if (/###/.test(id)) {
      const [url, token] = id.split('###')
      id = url
      cookie = `MUSIC_U=${token}`
    }
    if ((/[?&:/]/.test(id))) {
      if (this.regExps.listDetailLink.test(id)) {
        id = id.replace(this.regExps.listDetailLink, '$1')
      } else if (this.regExps.listDetailLink2.test(id)) {
        id = id.replace(this.regExps.listDetailLink2, '$1')
      } else {
        id = await this.handleParseId(id)
      }
      // console.log(id)
    }
    return { id, cookie }
  },
  async getListDetail(rawId, page, tryNum = 0) { // 获取歌曲列表内的音乐
    if (tryNum > 2) return Promise.reject(new Error('try max num'))

    const { id, cookie } = await this.getListId(rawId)
    if (cookie) this.cookie = cookie

    const requestObj_listDetail = httpRequest('https://music.163.com/api/linux/forward', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
        Cookie: this.cookie,
      },
      form: linuxapi({
        method: 'POST',
        url: 'https://music.163.com/api/v3/playlist/detail',
        params: {
          id,
          n: this.limit_song,
          s: 8,
        },
      }),
    })
    const { statusCode, body } = await requestObj_listDetail
    if (statusCode !== 200 || body.code !== this.successCode) return this.getListDetail(id, page, ++tryNum)
    let limit = 1000
    let rangeStart = (page - 1) * limit
    // console.log(body)
    let list
    if (body.playlist.trackIds.length == body.privileges.length) {
      list = this.filterListDetail(body)
    } else {
      try {
        list = (await wyMusicDetail.getList(body.playlist.trackIds.slice(rangeStart, limit * page).map(trackId => trackId.id))).list
      } catch (err) {
        console.log(err)
        if (err.message == 'try max num') {
          throw err
        } else {
          return this.getListDetail(id, page, ++tryNum)
        }
      }
    }
    // console.log(list)
    return {
      list,
      page,
      limit,
      total: body.playlist.trackIds.length,
      source: 'wy',
      info: {
        play_count: formatPlayCount(body.playlist.playCount),
        name: body.playlist.name,
        img: body.playlist.coverImgUrl,
        desc: body.playlist.description,
        author: body.playlist.creator.nickname,
      },
    }
  },
  filterListDetail({ playlist: { tracks }, privileges }) {
    // console.log(tracks, privileges)
    const list = []
    tracks.forEach((item, index) => {
      const types = []
      const _types = {}
      let size
      let privilege = privileges[index]
      if (privilege.id !== item.id) privilege = privileges.find(p => p.id === item.id)
      if (!privilege) return

      if (privilege.maxBrLevel == 'hires') {
        size = item.hr ? sizeFormate(item.hr.size) : null
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = {
          size,
        }
      }
      switch (privilege.maxbr) {
        case 999000:
          size = null
          types.push({ type: 'flac', size })
          _types.flac = {
            size,
          }
        // eslint-disable-next-line no-fallthrough
        case 320000:
          size = item.h ? sizeFormate(item.h.size) : null
          types.push({ type: '320k', size })
          _types['320k'] = {
            size,
          }
        // eslint-disable-next-line no-fallthrough
        case 192000:
        // eslint-disable-next-line no-fallthrough
        case 128000:
          size = item.l ? sizeFormate(item.l.size) : null
          types.push({ type: '128k', size })
          _types['128k'] = {
            size,
          }
      }

      types.reverse()

      if (item.pc) {
        list.push({
          singer: item.pc.ar ?? '',
          name: item.pc.sn ?? '',
          albumName: item.pc.alb ?? '',
          albumId: item.al?.id,
          source: 'wy',
          interval: formatPlayTime(item.dt / 1000),
          songmid: item.id,
          img: item.al?.picUrl ?? '',
          lrc: null,
          otherSource: null,
          types,
          _types,
          typeUrl: {},
        })
      } else {
        list.push({
          singer: formatSingerName(item.ar, 'name'),
          name: item.name ?? '',
          albumName: item.al?.name,
          albumId: item.al?.id,
          source: 'wy',
          interval: formatPlayTime(item.dt / 1000),
          songmid: item.id,
          img: item.al?.picUrl,
          lrc: null,
          otherSource: null,
          types,
          _types,
          typeUrl: {},
        })
      }
    })
    return list
  },

  // 获取列表数据
  getList(sortId, tagId, page, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    if (this._requestObj_list && this._requestObj_list.cancelHttp) this._requestObj_list.cancelHttp()
    this._requestObj_list = httpRequest('https://music.163.com/weapi/playlist/list', {
      method: 'post',
      form: weapi({
        cat: tagId || '全部', // 全部,华语,欧美,日语,韩语,粤语,小语种,流行,摇滚,民谣,电子,舞曲,说唱,轻音乐,爵士,乡村,R&B/Soul,古典,民族,英伦,金属,朋克,蓝调,雷鬼,世界音乐,拉丁,另类/独立,New Age,古风,后摇,Bossa Nova,清晨,夜晚,学习,工作,午休,下午茶,地铁,驾车,运动,旅行,散步,酒吧,怀旧,清新,浪漫,性感,伤感,治愈,放松,孤独,感动,兴奋,快乐,安静,思念,影视原声,ACG,儿童,校园,游戏,70后,80后,90后,网络歌曲,KTV,经典,翻唱,吉他,钢琴,器乐,榜单,00后
        order: sortId, // hot,new
        limit: this.limit_list,
        offset: this.limit_list * (page - 1),
        total: true,
      }),
    })
    return this._requestObj_list.then(({ body }) => {
      // console.log(body)
      if (body.code !== this.successCode) return this.getList(sortId, tagId, page, ++tryNum)
      return {
        list: this.filterList(body.playlists),
        total: parseInt(body.total),
        page,
        limit: this.limit_list,
        source: 'wy',
      }
    })
  },
  filterList(rawData) {
    // console.log(rawData)
    return rawData.map(item => ({
      play_count: formatPlayCount(item.playCount),
      id: String(item.id),
      author: item.creator.nickname,
      name: item.name,
      time: item.createTime ? dateFormat(item.createTime, 'Y-M-D') : '',
      img: item.coverImgUrl,
      grade: item.grade,
      total: item.trackCount,
      desc: item.description,
      source: 'wy',
    }))
  },

  // 获取标签
  getTag(tryNum = 0) {
    if (this._requestObj_tags && this._requestObj_tags.cancelHttp) this._requestObj_tags.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_tags = httpRequest('https://music.163.com/weapi/playlist/catalogue', {
      method: 'post',
      form: weapi({}),
    })
    return this._requestObj_tags.then(({ body }) => {
      // console.log(JSON.stringify(body))
      if (body.code !== this.successCode) return this.getTag(++tryNum)
      return this.filterTagInfo(body)
    })
  },
  filterTagInfo({ sub, categories }) {
    const subList = {}
    for (const item of sub) {
      if (!subList[item.category]) subList[item.category] = []
      subList[item.category].push({
        parent_id: categories[item.category],
        parent_name: categories[item.category],
        id: item.name,
        name: item.name,
        source: 'wy',
      })
    }

    const list = []
    for (const key of Object.keys(categories)) {
      list.push({
        name: categories[key],
        list: subList[key],
        source: 'wy',
      })
    }
    return list
  },

  // 获取热门标签
  getHotTag(tryNum = 0) {
    if (this._requestObj_hotTags && this._requestObj_hotTags.cancelHttp) this._requestObj_hotTags.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_hotTags = httpRequest('https://music.163.com/weapi/playlist/hottags', {
      method: 'post',
      form: weapi({}),
    })
    return this._requestObj_hotTags.then(({ body }) => {
      // console.log(JSON.stringify(body))
      if (body.code !== this.successCode) return this.getTag(++tryNum)
      return this.filterHotTagInfo(body.tags)
    })
  },
  filterHotTagInfo(rawList) {
    return rawList.map(item => ({
      id: item.playlistTag.name,
      name: item.playlistTag.name,
      source: 'wy',
    }))
  },

  getTags() {
    return Promise.all([this.getTag(), this.getHotTag()]).then(([tags, hotTag]) => ({ tags, hotTag, source: 'wy' }))
  },

  async getDetailPageUrl(rawId) {
    const { id } = await this.getListId(rawId)
    return `https://music.163.com/#/playlist?id=${id}`
  },

  search(text, page, limit = 20) {
    return wyEapiRequest('/api/cloudsearch/pc', {
      s: text,
      type: 1000, // 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频
      limit,
      total: page == 1,
      offset: limit * (page - 1),
    })
      .then(({ body }) => {
        if (body.code != this.successCode) throw new Error('filed')
        // console.log(body)
        return {
          list: this.filterList(body.result.playlists),
          limit,
          total: body.result.playlistCount,
          source: 'wy',
        }
      })
  },
}
// ---------------- wy/leaderboard.js 移植 ----------------
const wyTopList = [{ id: 'wy__19723756', name: '飙升榜', bangid: '19723756' },
  { id: 'wy__3779629', name: '新歌榜', bangid: '3779629' },
  { id: 'wy__2884035', name: '原创榜', bangid: '2884035' },
  { id: 'wy__3778678', name: '热歌榜', bangid: '3778678' },
  { id: 'wy__991319590', name: '说唱榜', bangid: '991319590' },
  { id: 'wy__71384707', name: '古典榜', bangid: '71384707' },
  { id: 'wy__1978921795', name: '电音榜', bangid: '1978921795' },
  { id: 'wy__5453912201', name: '黑胶VIP爱听榜', bangid: '5453912201' },
  { id: 'wy__71385702', name: 'ACG榜', bangid: '71385702' },
  { id: 'wy__745956260', name: '韩语榜', bangid: '745956260' },
  { id: 'wy__10520166', name: '国电榜', bangid: '10520166' },
  { id: 'wy__180106', name: 'UK排行榜周榜', bangid: '180106' },
  { id: 'wy__60198', name: '美国Billboard榜', bangid: '60198' },
  { id: 'wy__3812895', name: 'Beatport全球电子舞曲榜', bangid: '3812895' },
  { id: 'wy__21845217', name: 'KTV唛榜', bangid: '21845217' },
  { id: 'wy__60131', name: '日本Oricon榜', bangid: '60131' },
  { id: 'wy__2809513713', name: '欧美热歌榜', bangid: '2809513713' },
  { id: 'wy__2809577409', name: '欧美新歌榜', bangid: '2809577409' },
  { id: 'wy__27135204', name: '法国 NRJ Vos Hits 周榜', bangid: '27135204' },
  { id: 'wy__3001835560', name: 'ACG动画榜', bangid: '3001835560' },
  { id: 'wy__3001795926', name: 'ACG游戏榜', bangid: '3001795926' },
  { id: 'wy__3001890046', name: 'ACG VOCALOID榜', bangid: '3001890046' },
  { id: 'wy__3112516681', name: '中国新乡村音乐排行榜', bangid: '3112516681' },
  { id: 'wy__5059644681', name: '日语榜', bangid: '5059644681' },
  { id: 'wy__5059633707', name: '摇滚榜', bangid: '5059633707' },
  { id: 'wy__5059642708', name: '国风榜', bangid: '5059642708' },
  { id: 'wy__5338990334', name: '潜力爆款榜', bangid: '5338990334' },
  { id: 'wy__5059661515', name: '民谣榜', bangid: '5059661515' },
  { id: 'wy__6688069460', name: '听歌识曲榜', bangid: '6688069460' },
  { id: 'wy__6723173524', name: '网络热歌榜', bangid: '6723173524' },
  { id: 'wy__6732051320', name: '俄语榜', bangid: '6732051320' },
  { id: 'wy__6732014811', name: '越南语榜', bangid: '6732014811' },
  { id: 'wy__6886768100', name: '中文DJ榜', bangid: '6886768100' },
  { id: 'wy__6939992364', name: '俄罗斯top hit流行音乐榜', bangid: '6939992364' },
  { id: 'wy__7095271308', name: '泰语榜', bangid: '7095271308' },
  { id: 'wy__7356827205', name: 'BEAT排行榜', bangid: '7356827205' },
  { id: 'wy__7325478166', name: '编辑推荐榜VOL.44 天才女子摇滚乐队boygenius剖白卑微心迹', bangid: '7325478166' },
  { id: 'wy__7603212484', name: 'LOOK直播歌曲榜', bangid: '7603212484' },
  { id: 'wy__7775163417', name: '赏音榜', bangid: '7775163417' },
  { id: 'wy__7785123708', name: '黑胶VIP新歌榜', bangid: '7785123708' },
  { id: 'wy__7785066739', name: '黑胶VIP热歌榜', bangid: '7785066739' },
  { id: 'wy__7785091694', name: '黑胶VIP爱搜榜', bangid: '7785091694' },
]

const wyLeaderboard = {
  limit: 100000,
  list: [
    {
      id: 'wybsb',
      name: '飙升榜',
      bangid: '19723756',
    },
    {
      id: 'wyrgb',
      name: '热歌榜',
      bangid: '3778678',
    },
    {
      id: 'wyxgb',
      name: '新歌榜',
      bangid: '3779629',
    },
    {
      id: 'wyycb',
      name: '原创榜',
      bangid: '2884035',
    },
    {
      id: 'wygdb',
      name: '古典榜',
      bangid: '71384707',
    },
    {
      id: 'wydouyb',
      name: '抖音榜',
      bangid: '2250011882',
    },
    {
      id: 'wyhyb',
      name: '韩语榜',
      bangid: '745956260',
    },
    {
      id: 'wydianyb',
      name: '电音榜',
      bangid: '1978921795',
    },
    {
      id: 'wydjb',
      name: '电竞榜',
      bangid: '2006508653',
    },
    {
      id: 'wyktvbb',
      name: 'KTV唛榜',
      bangid: '21845217',
    },
  ],
  getUrl(id) {
    return `https://music.163.com/discover/toplist?id=${id}`
  },
  regExps: {
    list: /<textarea id="song-list-pre-data" style="display:none;">(.+?)<\/textarea>/,
  },
  _requestBoardsObj: null,
  getBoardsData() {
    if (this._requestBoardsObj && this._requestBoardsObj.cancelHttp) this._requestBoardsObj.cancelHttp()
    this._requestBoardsObj = httpRequest('https://music.163.com/weapi/toplist', {
      method: 'post',
      form: weapi({}),
    })
    return this._requestBoardsObj
  },
  getData(id) {
    const requestBoardsDetailObj = httpRequest('https://music.163.com/weapi/v3/playlist/detail', {
      method: 'post',
      form: weapi({
        id,
        n: 100000,
        p: 1,
      }),
    })
    return requestBoardsDetailObj
  },

  filterBoardsData(rawList) {
    // console.log(rawList)
    let list = []
    for (const board of rawList) {
      // 排除 MV榜
      // if (board.id == 201) continue
      list.push({
        id: 'wy__' + board.id,
        name: board.name,
        bangid: String(board.id),
      })
    }
    return list
  },
  async getBoards(retryNum = 0) {
    // if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    // let response
    // try {
    //   response = await this.getBoardsData()
    // } catch (error) {
    //   return this.getBoards(retryNum)
    // }
    // console.log(response.body)
    // if (response.statusCode !== 200 || response.body.code !== 200) return this.getBoards(retryNum)
    // const list = this.filterBoardsData(response.body.list)
    // console.log(list)
    // console.log(JSON.stringify(list))
    // this.list = list
    // return {
    //   list,
    //   source: 'wy',
    // }
    this.list = wyTopList
    return {
      list: wyTopList,
      source: 'wy',
    }
  },
  async getList(bangid, page, retryNum = 0) {
    if (++retryNum > 6) return Promise.reject(new Error('try max num'))
    // console.log(bangid)
    let resp
    try {
      resp = await this.getData(bangid)
    } catch (err) {
      if (err.message == 'try max num') {
        throw err
      } else {
        return this.getList(bangid, page, retryNum)
      }
    }
    if (resp.statusCode !== 200 || resp.body.code !== 200) return this.getList(bangid, page, retryNum)
    // console.log(resp.body)
    let musicDetail
    try {
      musicDetail = await wyMusicDetail.getList(resp.body.playlist.trackIds.map(trackId => trackId.id))
    } catch (err) {
      console.log(err)
      if (err.message == 'try max num') {
        throw err
      } else {
        return this.getList(bangid, page, retryNum)
      }
    }
    // console.log(musicDetail)
    return {
      total: musicDetail.list.length,
      list: musicDetail.list,
      limit: this.limit,
      page,
      source: 'wy',
    }
  },

  getDetailPageUrl(id) {
    if (typeof id == 'string') id = id.replace('wy__', '')
    return `https://music.163.com/#/discover/toplist?id=${id}`
  },
}
// ---------------- tx/songList.js 移植 ----------------
const txSongList = {
  _requestObj_tags: null,
  _requestObj_hotTags: null,
  _requestObj_list: null,
  limit_list: 36,
  limit_song: 100000,
  successCode: 0,
  sortList: [
    {
      name: '最热',
      id: 5,
    },
    {
      name: '最新',
      id: 2,
    },
  ],
  regExps: {
    hotTagHtml: /class="c_bg_link js_tag_item" data-id="\w+">.+?<\/a>/g,
    hotTag: /data-id="(\w+)">(.+?)<\/a>/,

    // https://y.qq.com/n/yqq/playlist/7217720898.html
    // https://i.y.qq.com/n2/m/share/details/taoge.html?platform=11&appshare=android_qq&appversion=9050006&id=7217720898&ADTAG=qfshare
    listDetailLink: /\/playlist\/(\d+)/,
    listDetailLink2: /id=(\d+)/,
  },
  tagsUrl: 'https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=%7B%22tags%22%3A%7B%22method%22%3A%22get_all_categories%22%2C%22param%22%3A%7B%22qq%22%3A%22%22%7D%2C%22module%22%3A%22playlist.PlaylistAllCategoriesServer%22%7D%7D',
  hotTagUrl: 'https://c.y.qq.com/node/pc/wk_v15/category_playlist.html',
  getListUrl(sortId, id, page) {
    if (id) {
      id = parseInt(id)
      return `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify({
        comm: { cv: 1602, ct: 20 },
        playlist: {
          method: 'get_category_content',
          param: {
            titleid: id,
            caller: '0',
            category_id: id,
            size: this.limit_list,
            page: page - 1,
            use_page: 1,
          },
          module: 'playlist.PlayListCategoryServer',
        },
      }))}`
    }
    return `https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0&data=${encodeURIComponent(JSON.stringify({
      comm: { cv: 1602, ct: 20 },
      playlist: {
        method: 'get_playlist_by_tag',
        param: { id: 10000000, sin: this.limit_list * (page - 1), size: this.limit_list, order: sortId, cur_page: page },
        module: 'playlist.PlayListPlazaServer',
      },
    }))}`
  },
  getListDetailUrl(id) {
    return `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&new_format=1&disstid=${id}&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`
  },

  // http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=2849349915&pn=0&rn=100&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1
  // 获取标签
  getTag(tryNum = 0) {
    if (this._requestObj_tags && this._requestObj_tags.cancelHttp) this._requestObj_tags.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_tags = httpRequest(this.tagsUrl)
    return this._requestObj_tags.then(({ body }) => {
      if (body.code !== this.successCode) return this.getTag(++tryNum)
      return this.filterTagInfo(body.tags.data.v_group)
    })
  },
  // 获取标签
  getHotTag(tryNum = 0) {
    if (this._requestObj_hotTags && this._requestObj_hotTags.cancelHttp) this._requestObj_hotTags.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_hotTags = httpRequest(this.hotTagUrl)
    return this._requestObj_hotTags.then(({ statusCode, body }) => {
      if (statusCode !== 200) return this.getHotTag(++tryNum)
      return this.filterInfoHotTag(body)
    })
  },
  filterInfoHotTag(html) {
    let hotTag = html.match(this.regExps.hotTagHtml)
    const hotTags = []
    if (!hotTag) return hotTags

    hotTag.forEach(tagHtml => {
      let result = tagHtml.match(this.regExps.hotTag)
      if (!result) return
      hotTags.push({
        id: parseInt(result[1]),
        name: result[2],
        source: 'tx',
      })
    })
    return hotTags
  },
  filterTagInfo(rawList) {
    return rawList.map(type => ({
      name: type.group_name,
      list: type.v_item.map(item => ({
        parent_id: type.group_id,
        parent_name: type.group_name,
        id: item.id,
        name: item.name,
        source: 'tx',
      })),
    }))
  },

  // 获取列表数据
  getList(sortId, tagId, page, tryNum = 0) {
    if (this._requestObj_list && this._requestObj_list.cancelHttp) this._requestObj_list.cancelHttp()
    if (tryNum > 2) return Promise.reject(new Error('try max num'))
    this._requestObj_list = httpRequest(
      this.getListUrl(sortId, tagId, page),
    )
    // console.log(this.getListUrl(sortId, tagId, page))
    return this._requestObj_list.then(({ body }) => {
      if (body.code !== this.successCode) return this.getList(sortId, tagId, page, ++tryNum)
      return tagId ? this.filterList2(body.playlist.data, page) : this.filterList(body.playlist.data, page)
    })
  },

  filterList(data, page) {
    return {
      list: data.v_playlist.map(item => ({
        play_count: formatPlayCount(item.access_num),
        id: String(item.tid),
        author: item.creator_info.nick,
        name: item.title,
        time: item.modify_time ? dateFormat(item.modify_time * 1000, 'Y-M-D') : '',
        img: item.cover_url_medium,
        // grade: item.favorcnt / 10,
        total: item.song_ids?.length,
        desc: decodeName(item.desc).replace(/<br>/g, '\n'),
        source: 'tx',
      })),
      total: data.total,
      page,
      limit: this.limit_list,
      source: 'tx',
    }
  },
  filterList2({ content }, page) {
    // console.log(content.v_item)
    return {
      list: content.v_item.map(({ basic }) => ({
        play_count: formatPlayCount(basic.play_cnt),
        id: String(basic.tid),
        author: basic.creator.nick,
        name: basic.title,
        // time: basic.publish_time,
        img: basic.cover.medium_url || basic.cover.default_url,
        // grade: basic.favorcnt / 10,
        desc: decodeName(basic.desc).replace(/<br>/g, '\n'),
        source: 'tx',
      })),
      total: content.total_cnt,
      page,
      limit: this.limit_list,
      source: 'tx',
    }
  },

  async handleParseId(link, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('link try max num'))

    const requestObj_listDetailLink = httpRequest(link)
    const { headers: { location }, statusCode } = await requestObj_listDetailLink
    // console.log(headers)
    if (statusCode > 400) return this.handleParseId(link, ++retryNum)
    return location == null ? link : location
  },

  async getListId(id) {
    if ((/[?&:/]/.test(id))) {
      if (!this.regExps.listDetailLink.test(id)) {
        id = await this.handleParseId(id)
      }
      let result = this.regExps.listDetailLink.exec(id)
      if (!result) {
        result = this.regExps.listDetailLink2.exec(id)
        if (!result) throw new Error('failed')
      }
      id = result[1]
      // console.log(id)
    }
    return id
  },
  // 获取歌曲列表内的音乐
  async getListDetail(id, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'))

    id = await this.getListId(id)

    const requestObj_listDetail = httpRequest(this.getListDetailUrl(id), {
      headers: {
        Origin: 'https://y.qq.com',
        Referer: `https://y.qq.com/n/yqq/playsquare/${id}.html`,
      },
    })
    const { body } = await requestObj_listDetail

    if (body.code !== this.successCode) return this.getListDetail(id, ++tryNum)
    const cdlist = body.cdlist[0]
    return {
      list: this.filterListDetail(cdlist.songlist),
      page: 1,
      limit: cdlist.songlist.length + 1,
      total: cdlist.songlist.length,
      source: 'tx',
      info: {
        name: cdlist.dissname,
        img: cdlist.logo,
        desc: decodeName(cdlist.desc).replace(/<br>/g, '\n'),
        author: cdlist.nickname,
        play_count: formatPlayCount(cdlist.visitnum),
      },
    }
  },
  filterListDetail(rawList) {
    // console.log(rawList)
    return rawList.map(item => {
      let types = []
      let _types = {}
      if (item.file.size_128mp3 !== 0) {
        let size = sizeFormate(item.file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = {
          size,
        }
      }
      if (item.file.size_320mp3 !== 0) {
        let size = sizeFormate(item.file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = {
          size,
        }
      }
      if (item.file.size_flac !== 0) {
        let size = sizeFormate(item.file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = {
          size,
        }
      }
      if (item.file.size_hires !== 0) {
        let size = sizeFormate(item.file.size_hires)
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = {
          size,
        }
      }
      // types.reverse()
      return {
        singer: formatSingerName(item.singer, 'name'),
        name: item.title,
        albumName: item.album.name,
        albumId: item.album.mid,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album.mid,
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img: (item.album.name === '' || item.album.name === '空')
          ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg`,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      }
    })
  },
  getTags() {
    return Promise.all([this.getTag(), this.getHotTag()]).then(([tags, hotTag]) => ({ tags, hotTag, source: 'tx' }))
  },

  async getDetailPageUrl(id) {
    id = await this.getListId(id)

    return `https://y.qq.com/n/ryqq/playlist/${id}`
  },

  search(text, page, limit = 20, retryNum = 0) {
    if (retryNum > 5) throw new Error('max retry')
    return httpRequest(`http://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist?page_no=${page - 1}&num_per_page=${limit}&format=json&query=${encodeURIComponent(text)}&remoteplace=txt.yqq.playlist&inCharset=utf8&outCharset=utf-8`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
        Referer: 'http://y.qq.com/portal/search.html',
      },
    })
      .then(({ body }) => {
        if (body.code != 0) return this.search(text, page, limit, ++retryNum)
        // console.log(body.data.list)
        return {
          list: body.data.list.map(item => {
            return {
              play_count: formatPlayCount(item.listennum),
              id: String(item.dissid),
              author: decodeName(item.creator.name),
              name: decodeName(item.dissname),
              time: dateFormat(item.createtime, 'Y-M-D'),
              img: item.imgurl,
              // grade: item.favorcnt / 10,
              total: item.song_count,
              desc: decodeName(decodeName(item.introduction)).replace(/<br>/g, '\n'),
              source: 'tx',
            }
          }),
          limit,
          total: body.data.sum,
          source: 'tx',
        }
      })
  },
}

// ---------------- tx/leaderboard.js 移植 ----------------
const txBoardList = [{ id: 'tx__4', name: '流行指数榜', bangid: '4' }, { id: 'tx__26', name: '热歌榜', bangid: '26' }, { id: 'tx__27', name: '新歌榜', bangid: '27' }, { id: 'tx__62', name: '飙升榜', bangid: '62' }, { id: 'tx__58', name: '说唱榜', bangid: '58' }, { id: 'tx__57', name: '喜力电音榜', bangid: '57' }, { id: 'tx__28', name: '网络歌曲榜', bangid: '28' }, { id: 'tx__5', name: '内地榜', bangid: '5' }, { id: 'tx__3', name: '欧美榜', bangid: '3' }, { id: 'tx__59', name: '香港地区榜', bangid: '59' }, { id: 'tx__16', name: '韩国榜', bangid: '16' }, { id: 'tx__60', name: '抖快榜', bangid: '60' }, { id: 'tx__29', name: '影视金曲榜', bangid: '29' }, { id: 'tx__17', name: '日本榜', bangid: '17' }, { id: 'tx__52', name: '腾讯音乐人原创榜', bangid: '52' }, { id: 'tx__36', name: 'K歌金曲榜', bangid: '36' }, { id: 'tx__61', name: '台湾地区榜', bangid: '61' }, { id: 'tx__63', name: 'DJ舞曲榜', bangid: '63' }, { id: 'tx__64', name: '综艺新歌榜', bangid: '64' }, { id: 'tx__65', name: '国风热歌榜', bangid: '65' }, { id: 'tx__67', name: '听歌识曲榜', bangid: '67' }, { id: 'tx__72', name: '动漫音乐榜', bangid: '72' }, { id: 'tx__73', name: '游戏音乐榜', bangid: '73' }, { id: 'tx__75', name: '有声榜', bangid: '75' }, { id: 'tx__131', name: '校园音乐人排行榜', bangid: '131' }]

const txLeaderboard = {
  limit: 300,
  list: [
    {
      id: 'txlxzsb',
      name: '流行榜',
      bangid: 4,
    },
    {
      id: 'txrgb',
      name: '热歌榜',
      bangid: 26,
    },
    {
      id: 'txwlhgb',
      name: '网络榜',
      bangid: 28,
    },
    {
      id: 'txdyb',
      name: '抖音榜',
      bangid: 60,
    },
    {
      id: 'txndb',
      name: '内地榜',
      bangid: 5,
    },
    {
      id: 'txxgb',
      name: '香港榜',
      bangid: 59,
    },
    {
      id: 'txtwb',
      name: '台湾榜',
      bangid: 61,
    },
    {
      id: 'txoumb',
      name: '欧美榜',
      bangid: 3,
    },
    {
      id: 'txhgb',
      name: '韩国榜',
      bangid: 16,
    },
    {
      id: 'txrbb',
      name: '日本榜',
      bangid: 17,
    },
    {
      id: 'txtybb',
      name: 'YouTube榜',
      bangid: 128,
    },
  ],
  listDetailRequest(id, period, limit) {
    // console.log(id, period, limit)
    return httpRequest('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
      },
      body: {
        toplist: {
          module: 'musicToplist.ToplistInfoServer',
          method: 'GetDetail',
          param: {
            topid: id,
            num: limit,
            period,
          },
        },
        comm: {
          uin: 0,
          format: 'json',
          ct: 20,
          cv: 1859,
        },
      },
    })
  },
  regExps: {
    periodList: /<i class="play_cover__btn c_tx_link js_icon_play" data-listkey=".+?" data-listname=".+?" data-tid=".+?" data-date=".+?" .+?<\/i>/g,
    period: /data-listname="(.+?)" data-tid=".*?\/(.+?)" data-date="(.+?)" .+?<\/i>/,
  },
  periods: {},
  periodUrl: 'https://c.y.qq.com/node/pc/wk_v15/top.html',
  _requestBoardsObj: null,
  getBoardsData() {
    if (this._requestBoardsObj && this._requestBoardsObj.cancelHttp) this._requestBoardsObj.cancelHttp()
    this._requestBoardsObj = httpRequest('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=1928093487&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5')
    return this._requestBoardsObj
  },
  getData(url) {
    const requestDataObj = httpRequest(url)
    return requestDataObj
  },
  filterData(rawList) {
    // console.log(rawList)
    return rawList.map(item => {
      let types = []
      let _types = {}
      if (item.file.size_128mp3 !== 0) {
        let size = sizeFormate(item.file.size_128mp3)
        types.push({ type: '128k', size })
        _types['128k'] = {
          size,
        }
      }
      if (item.file.size_320mp3 !== 0) {
        let size = sizeFormate(item.file.size_320mp3)
        types.push({ type: '320k', size })
        _types['320k'] = {
          size,
        }
      }
      if (item.file.size_flac !== 0) {
        let size = sizeFormate(item.file.size_flac)
        types.push({ type: 'flac', size })
        _types.flac = {
          size,
        }
      }
      if (item.file.size_hires !== 0) {
        let size = sizeFormate(item.file.size_hires)
        types.push({ type: 'flac24bit', size })
        _types.flac24bit = {
          size,
        }
      }
      // types.reverse()
      return {
        singer: formatSingerName(item.singer, 'name'),
        name: item.title,
        albumName: item.album.name,
        albumId: item.album.mid,
        source: 'tx',
        interval: formatPlayTime(item.interval),
        songId: item.id,
        albumMid: item.album.mid,
        strMediaMid: item.file.media_mid,
        songmid: item.mid,
        img: (item.album.name === '' || item.album.name === '空')
          ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
          : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg`,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      }
    })
  },
  getPeriods(bangid) {
    return this.getData(this.periodUrl).then(({ body: html }) => {
      let result = html.match(this.regExps.periodList)
      if (!result) return Promise.reject(new Error('get data failed'))
      result.forEach(item => {
        let result = item.match(this.regExps.period)
        if (!result) return
        this.periods[result[2]] = {
          name: result[1],
          bangid: result[2],
          period: result[3],
        }
      })
      const info = this.periods[bangid]
      return info && info.period
    })
  },
  filterBoardsData(rawList) {
    // console.log(rawList)
    let list = []
    for (const board of rawList) {
      // 排除 MV榜
      if (board.id == 201) continue

      if (board.topTitle.startsWith('巅峰榜·')) {
        board.topTitle = board.topTitle.substring(4, board.topTitle.length)
      }
      if (!board.topTitle.endsWith('榜')) board.topTitle += '榜'
      list.push({
        id: 'tx__' + board.id,
        name: board.topTitle,
        bangid: String(board.id),
      })
    }
    return list
  },
  async getBoards(retryNum = 0) {
    // if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    // let response
    // try {
    //   response = await this.getBoardsData()
    // } catch (error) {
    //   return this.getBoards(retryNum)
    // }
    // // console.log(response.body)
    // if (response.statusCode !== 200 || response.body.code !== 0) return this.getBoards(retryNum)
    // const list = this.filterBoardsData(response.body.data.topList)
    // console.log(list)
    // console.log(JSON.stringify(list))
    // this.list = list
    // return {
    //   list,
    //   source: 'tx',
    // }
    this.list = txBoardList
    return {
      list: txBoardList,
      source: 'tx',
    }
  },
  getList(bangid, page, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'))
    bangid = parseInt(bangid)
    let info = this.periods[bangid]
    let p = info ? Promise.resolve(info.period) : this.getPeriods(bangid)
    return p.then(period => {
      return this.listDetailRequest(bangid, period, this.limit).then(resp => {
        if (resp.body.code !== 0) return this.getList(bangid, page, retryNum)
        return {
          total: resp.body.toplist.data.songInfoList.length,
          list: this.filterData(resp.body.toplist.data.songInfoList),
          limit: this.limit,
          page: 1,
          source: 'tx',
        }
      })
    })
  },

  getDetailPageUrl(id) {
    if (typeof id == 'string') id = id.replace('tx__', '')
    return `https://y.qq.com/n/ryqq/toplist/${id}`
  },
}

// ---------------- 导出约定 ----------------
const normalizeBangId = (id, prefix) => String(id).startsWith(prefix) ? String(id).slice(prefix.length) : String(id)

export const PLATFORMS = {
  wy: {
    songList: {
      getLists: async (type, page, limit) => {
        const tagId = type === 'all' ? undefined : type
        return wySongList.getList('hot', tagId, page)
      },
      getList: async (id, page, limit) => {
        return wySongList.getListDetail(id, page)
      },
    },
    leaderboard: {
      getLists: async () => wyLeaderboard.getBoards(),
      getList: async (id, page, limit) => {
        return wyLeaderboard.getList(normalizeBangId(id, 'wy__'), page)
      },
    },
  },
  tx: {
    songList: {
      getLists: async (type, page, limit) => {
        const tagId = type === 'all' ? undefined : type
        return txSongList.getList(5, tagId, page)
      },
      getList: async (id, page, limit) => {
        return txSongList.getListDetail(id)
      },
    },
    leaderboard: {
      getLists: async () => txLeaderboard.getBoards(),
      getList: async (id, page, limit) => {
        return txLeaderboard.getList(normalizeBangId(id, 'tx__'), page)
      },
    },
  },
}