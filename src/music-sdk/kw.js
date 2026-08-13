import { httpGet } from './http.js'
import { formatPlayTime, decodeName, formatSinger } from './utils.js'

const limit = 30

const regExps = {
  mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/,
}

export const kwSearch = async (str, page = 1) => {
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`
  const result = await httpGet(url)
  if (!result || (result.TOTAL !== '0' && result.SHOW === '0')) {
    throw new Error('酷我搜索失败')
  }
  const list = handleResult(result.abslist)
  const total = parseInt(result.TOTAL) || 0
  return {
    list,
    allPage: Math.ceil(total / limit),
    total,
    limit,
    source: 'kw',
  }
}

const handleResult = rawData => {
  const result = []
  if (!rawData) return result
  for (let i = 0; i < rawData.length; i++) {
    const info = rawData[i]
    const songId = String(info.MUSICRID || '').replace('MUSIC_', '')

    if (!info.N_MINFO) {
      console.log('[MusicSdk] kw N_MINFO undefined')
      continue
    }

    const types = []
    const _types = {}

    const infoArr = String(info.N_MINFO).split(';')
    for (let item of infoArr) {
      const mInfo = item.match(regExps.mInfo)
      if (!mInfo) continue
      switch (mInfo[2]) {
        case '4000':
          types.push({ type: 'flac24bit', size: mInfo[4] })
          _types.flac24bit = { size: mInfo[4].toLocaleUpperCase() }
          break
        case '2000':
          types.push({ type: 'flac', size: mInfo[4] })
          _types.flac = { size: mInfo[4].toLocaleUpperCase() }
          break
        case '320':
          types.push({ type: '320k', size: mInfo[4] })
          _types['320k'] = { size: mInfo[4].toLocaleUpperCase() }
          break
        case '128':
          types.push({ type: '128k', size: mInfo[4] })
          _types['128k'] = { size: mInfo[4].toLocaleUpperCase() }
          break
      }
    }
    types.reverse()

    const interval = parseInt(info.DURATION)

    result.push({
      name: decodeName(info.SONGNAME),
      singer: formatSinger(decodeName(info.ARTIST)),
      source: 'kw',
      songmid: songId,
      songId,
      id: songId,
      albumId: decodeName(info.ALBUMID || ''),
      interval: Number.isNaN(interval) ? 0 : formatPlayTime(interval),
      duration: Number.isNaN(interval) ? 0 : interval,
      albumName: info.ALBUM ? decodeName(info.ALBUM) : '',
      lrc: null,
      img: null,
      otherSource: null,
      types,
      _types,
      typeUrl: {},
    })
  }
  return result
}