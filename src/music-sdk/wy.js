import { eapi } from './crypto.js'
import { httpPostForm } from './http.js'
import { sizeFormate, formatPlayTime, formatSingerName } from './utils.js'

const limit = 30

export const wySearch = async (str, page = 1) => {
  const body = await httpPostForm('http://interface.music.163.com/eapi/batch', eapi('/api/search/song/list/page', {
    keyword: str,
    needCorrect: '1',
    channel: 'typing',
    offset: limit * (page - 1),
    scene: 'normal',
    total: page == 1,
    limit,
  }), {
    origin: 'https://music.163.com',
  })
  if (!body || body.code !== 200) throw new Error(body?.message || '网易云搜索失败')
  const list = (body.data?.resources || []).map(mapWyItem)
  return {
    list,
    allPage: Math.ceil((body.data?.totalCount || 0) / limit),
    total: body.data?.totalCount || 0,
    limit,
    source: 'wy',
  }
}

const mapWyItem = raw => {
  const item = raw.baseInfo.simpleSongData
  const types = []
  const _types = {}
  let size

  if (item.privilege.maxBrLevel == 'hires') {
    size = item.hr ? sizeFormate(item.hr.size) : null
    types.push({ type: 'flac24bit', size })
    _types.flac24bit = { size }
  }
  switch (item.privilege.maxbr) {
    case 999000:
      size = item.sq ? sizeFormate(item.sq.size) : null
      types.push({ type: 'flac', size })
      _types.flac = { size }
    // eslint-disable-next-line no-fallthrough
    case 320000:
      size = item.h ? sizeFormate(item.h.size) : null
      types.push({ type: '320k', size })
      _types['320k'] = { size }
    // eslint-disable-next-line no-fallthrough
    case 192000:
    case 128000:
      size = item.l ? sizeFormate(item.l.size) : null
      types.push({ type: '128k', size })
      _types['128k'] = { size }
  }
  types.reverse()

  return {
    name: item.name,
    singer: formatSingerName((item.ar || []).map(s => s.name).join('、')),
    albumName: item.al.name,
    albumId: item.al.id,
    source: 'wy',
    interval: formatPlayTime(item.dt / 1000),
    duration: Math.trunc(item.dt / 1000),
    songmid: String(item.id),
    songId: String(item.id),
    img: item.al.picUrl,
    lrc: null,
    types,
    _types,
    typeUrl: {},
  }
}