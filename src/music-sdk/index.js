import { wySearch } from './wy.js'
import { txSearch } from './tx.js'
import { kwSearch } from './kw.js'
import { kgSearch } from './kg.js'
import { mgSearch } from './mg.js'
import { PLATFORMS as LISTS_WYTX } from './lists-wytx.js'
import { PLATFORMS as LISTS_KWKGMG } from './lists-kwkgmg.js'

export const BUILTIN_SOURCES = ['wy', 'tx', 'kw', 'kg', 'mg']

const searchImpls = {
  wy: wySearch,
  tx: txSearch,
  kw: kwSearch,
  kg: kgSearch,
  mg: mgSearch,
}

const LISTS = { ...LISTS_WYTX, ...LISTS_KWKGMG }

export const isBuiltinSource = sourceId => BUILTIN_SOURCES.includes(sourceId)

export const builtinSearch = async (sourceId, keyword, page = 1) => {
  const impl = searchImpls[sourceId]
  if (!impl) throw new Error('Unsupported builtin source: ' + sourceId)
  const result = await impl(keyword, page)
  return {
    ...result,
    list: result.list.filter(Boolean).map(item => toNewSongInfo(item)),
  }
}

export const builtinSongLists = async (sourceId, type = 'all', page = 1, limit = 30) => {
  const p = LISTS[sourceId]
  if (!p?.songList) throw new Error('该音源不支持歌单')
  return p.songList.getLists(type, page, limit)
}

export const builtinSongList = async (sourceId, id, page = 1, limit = 50) => {
  const p = LISTS[sourceId]
  if (!p?.songList) throw new Error('该音源不支持歌单')
  const data = await p.songList.getList(id, page, limit)
  if (Array.isArray(data.list)) {
    data.list = data.list.filter(Boolean).map(item => toNewSongInfo(item))
  }
  return data
}

export const builtinLeaderboards = async sourceId => {
  const p = LISTS[sourceId]
  if (!p?.leaderboard) throw new Error('该音源不支持排行榜')
  return p.leaderboard.getLists()
}

export const builtinLeaderboard = async (sourceId, id, page = 1, limit = 100) => {
  const p = LISTS[sourceId]
  if (!p?.leaderboard) throw new Error('该音源不支持排行榜')
  const data = await p.leaderboard.getList(id, page, limit)
  if (Array.isArray(data.list)) {
    data.list = data.list.filter(Boolean).map(item => toNewSongInfo(item))
  }
  return data
}

export const toNewSongInfo = oldMusicInfo => {
  const meta = {
    songId: oldMusicInfo.songmid,
    albumName: oldMusicInfo.albumName,
    picUrl: oldMusicInfo.img,
    qualitys: oldMusicInfo.types,
    _qualitys: oldMusicInfo._types,
    albumId: oldMusicInfo.albumId,
  }
const newInfo = {
    id: `${oldMusicInfo.source}_${oldMusicInfo.songmid}`,
    name: oldMusicInfo.name,
    singer: oldMusicInfo.singer,
    source: oldMusicInfo.source,
    interval: oldMusicInfo.interval,
    duration: oldMusicInfo.duration,
    albumName: oldMusicInfo.albumName,
    songmid: oldMusicInfo.songmid,
    albumId: oldMusicInfo.albumId,
    types: oldMusicInfo.types,
    _types: oldMusicInfo._types,
    typeUrl: {},
    img: oldMusicInfo.img,
    meta,
  }

  if (oldMusicInfo._qualitys?.flac32bit && !oldMusicInfo._qualitys.flac24bit) {
    meta._qualitys.flac24bit = meta._qualitys.flac32bit
    delete meta._qualitys.flac32bit
    meta.qualitys = meta.qualitys.map(quality => {
      if (quality.type == 'flac32bit') quality.type = 'flac24bit'
      return quality
    })
  }

  switch (oldMusicInfo.source) {
    case 'kg':
      meta.hash = oldMusicInfo.hash
      newInfo.hash = oldMusicInfo.hash
      newInfo.id = oldMusicInfo.songmid + '_' + oldMusicInfo.hash
      break
    case 'tx':
      meta.strMediaMid = oldMusicInfo.strMediaMid
      meta.id = oldMusicInfo.songId
      meta.albumMid = oldMusicInfo.albumMid
      newInfo.songId = oldMusicInfo.songId
      newInfo.strMediaMid = oldMusicInfo.strMediaMid
      newInfo.albumMid = oldMusicInfo.albumMid
      break
    case 'mg':
      meta.copyrightId = oldMusicInfo.copyrightId
      meta.lrcUrl = oldMusicInfo.lrcUrl
      meta.mrcUrl = oldMusicInfo.mrcUrl
      meta.trcUrl = oldMusicInfo.trcUrl
      newInfo.copyrightId = oldMusicInfo.copyrightId
      break
  }

  return newInfo
}
