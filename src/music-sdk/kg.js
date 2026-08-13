import { httpGet } from './http.js'
import { decodeName, formatPlayTime, sizeFormate, formatSingerName } from './utils.js'

const limit = 30

export const kgSearch = async (str, page = 1) => {
  const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`
  const result = await httpGet(url)
  if (!result || result.error_code !== 0) throw new Error('酷狗搜索失败')
  const list = handleResult(result.data.lists)
  const total = result.data.total || 0
  return {
    list,
    allPage: Math.ceil(total / limit),
    total,
    limit,
    source: 'kg',
  }
}

const filterData = rawData => {
  const types = []
  const _types = {}
  if (rawData.FileSize !== 0) {
    let size = sizeFormate(rawData.FileSize)
    types.push({ type: '128k', size, hash: rawData.FileHash })
    _types['128k'] = { size, hash: rawData.FileHash }
  }
  if (rawData.HQFileSize !== 0) {
    let size = sizeFormate(rawData.HQFileSize)
    types.push({ type: '320k', size, hash: rawData.HQFileHash })
    _types['320k'] = { size, hash: rawData.HQFileHash }
  }
  if (rawData.SQFileSize !== 0) {
    let size = sizeFormate(rawData.SQFileSize)
    types.push({ type: 'flac', size, hash: rawData.SQFileHash })
    _types.flac = { size, hash: rawData.SQFileHash }
  }
  if (rawData.ResFileSize !== 0) {
    let size = sizeFormate(rawData.ResFileSize)
    types.push({ type: 'flac24bit', size, hash: rawData.ResFileHash })
    _types.flac24bit = { size, hash: rawData.ResFileHash }
  }
  return {
    singer: decodeName(formatSingerName(rawData.Singers, 'name')),
    name: decodeName(rawData.SongName),
    albumName: decodeName(rawData.AlbumName),
    albumId: rawData.AlbumID,
    songmid: String(rawData.Audioid),
    songId: String(rawData.Audioid),
    id: String(rawData.Audioid),
    source: 'kg',
    interval: formatPlayTime(rawData.Duration),
    duration: rawData.Duration || 0,
    _interval: rawData.Duration,
    img: null,
    lrc: null,
    otherSource: null,
    hash: rawData.FileHash,
    types,
    _types,
    typeUrl: {},
  }
}

const handleResult = rawData => {
  let ids = new Set()
  const list = []
  ;(rawData || []).forEach(item => {
    const key = item.Audioid + item.FileHash
    if (ids.has(key)) return
    ids.add(key)
    list.push(filterData(item))
    for (const childItem of item.Grp || []) {
      const childKey = item.Audioid + childItem.FileHash
      if (ids.has(childKey)) continue
      ids.add(childKey)
      list.push(filterData(childItem))
    }
  })
  return list
}