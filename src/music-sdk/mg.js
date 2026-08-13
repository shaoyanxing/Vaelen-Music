import { mgSignature } from './crypto.js'
import { httpGet } from './http.js'
import { sizeFormate, formatPlayTime, formatSingerName } from './utils.js'

const limit = 20

export const mgSearch = async (str, page = 1) => {
  const time = Date.now().toString()
  const signData = mgSignature(time, str)
  const { resultList, totalCount } = await doSearch(str, page, limit, time, signData)
  const total = parseInt(totalCount) || 0
  return {
    list: resultList.flatMap(mapMgResult),
    allPage: total ? Math.ceil(total / limit) : 0,
    total,
    limit,
    source: 'mg',
  }
}

const doSearch = async (str, page, limit, time, signData) => {
  const url = `https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=%7B%22song%22%3A1%2C%22album%22%3A0%2C%22singer%22%3A0%2C%22tagSong%22%3A1%2C%22mvSong%22%3A0%2C%22bestShow%22%3A1%2C%22songlist%22%3A0%2C%22lyricSong%22%3A0%7D&pageSize=${limit}&text=${encodeURIComponent(str)}&pageNo=${page}&sort=0&sid=USS`
  const body = await httpGet(url, {
    uiVersion: 'A_music_3.6.1',
    deviceId: signData.deviceId,
    timestamp: time,
    sign: signData.sign,
    channel: '0146921',
    'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
  })
  if (!body || body.code !== '000000') throw new Error(body?.info || '咪咕搜索失败')
  const songResultData = body.songResultData || { resultList: [] }
  return { resultList: songResultData.resultList || [], totalCount: songResultData.totalCount }
}

const mapMgResult = rawItems => {
  const list = []
  const ids = new Set()
  rawItems.forEach(data => {
    if (!data.songId || !data.copyrightId || ids.has(data.copyrightId)) return
    ids.add(data.copyrightId)

    const types = []
    const _types = {}
    data.audioFormats && data.audioFormats.forEach(type => {
      let size
      switch (type.formatType) {
        case 'PQ':
          size = sizeFormate(type.asize ?? type.isize)
          types.push({ type: '128k', size })
          _types['128k'] = { size }
          break
        case 'HQ':
          size = sizeFormate(type.asize ?? type.isize)
          types.push({ type: '320k', size })
          _types['320k'] = { size }
          break
        case 'SQ':
          size = sizeFormate(type.asize ?? type.isize)
          types.push({ type: 'flac', size })
          _types.flac = { size }
          break
        case 'ZQ24':
          size = sizeFormate(type.asize ?? type.isize)
          types.push({ type: 'flac24bit', size })
          _types.flac24bit = { size }
          break
      }
    })

    let img = data.img3 || data.img2 || data.img1 || null
    if (img && !/https?:/.test(img)) img = 'http://d.musicapp.migu.cn' + img

    list.push({
      singer: formatSingerName(data.singerList),
      name: data.name,
      albumName: data.album,
      albumId: data.albumId,
      songmid: String(data.songId),
      songId: String(data.songId),
      id: String(data.songId),
      copyrightId: data.copyrightId,
      source: 'mg',
      interval: formatPlayTime(data.duration),
      duration: Math.trunc(data.duration),
      img,
      lrc: null,
      lrcUrl: data.lrcUrl,
      mrcUrl: data.mrcurl,
      trcUrl: data.trcUrl,
      types,
      _types,
      typeUrl: {},
    })
  })
  return list
}