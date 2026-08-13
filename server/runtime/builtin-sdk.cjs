// 服务端内置音源搜索 SDK —— 从 src/music-sdk 移植（Node CJS 版本）
// 解决 Web 模式下浏览器 fetch 第三方接口的 CORS 问题，
// 并保证搜索返回的歌曲 ID 与 lx-music-desktop 内置 SDK 一致（可被自定义音源用于播放）。
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');

const BUILTIN_SOURCES = ['wy', 'tx', 'kw', 'kg', 'mg'];

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const httpRequest = (url, options = {}) => new Promise((resolve, reject) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = Object.assign({}, options.headers || {});
  if (!headers['User-Agent']) headers['User-Agent'] = DEFAULT_UA;
  if (headers['Accept-Encoding'] !== '' && !headers['Accept-Encoding']) {
    headers['Accept-Encoding'] = 'gzip, deflate, br';
  }
  let body;
  if (options.form) {
    body = new URLSearchParams(options.form).toString();
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (options.body !== undefined && options.body !== null) {
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (!headers['Content-Type'] && typeof options.body !== 'string') headers['Content-Type'] = 'application/json';
  }
  const parsedUrl = new URL(url);
  const proto = parsedUrl.protocol === 'https:' ? https : http;
  const req = proto.request({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.pathname + parsedUrl.search,
    method,
    headers,
    timeout: options.timeout || 20000,
  }, (res) => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      let raw = Buffer.concat(chunks);
      const encoding = (res.headers['content-encoding'] || '').trim().toLowerCase();
      try {
        if (encoding.includes('gzip')) raw = zlib.gunzipSync(raw);
        else if (encoding.includes('deflate')) raw = zlib.inflateSync(raw);
        else if (encoding.includes('br')) raw = zlib.brotliDecompressSync(raw);
      } catch (e) { /* keep raw */ }
      let text = raw.toString('utf8');
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
      resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed, raw });
    });
  });
  req.on('error', reject);
  req.on('timeout', () => { req.destroy(new Error('Request timeout')); });
  if (body !== undefined && body !== null) req.write(body);
  req.end();
});

// ---------------- 加密工具（crypto.js 移植） ----------------
const toMD5 = str => crypto.createHash('md5').update(String(str)).digest('hex');

const sha1Hex = str => crypto.createHash('sha1').update(String(str)).digest('hex');

const aes128EcbHex = (data, key) => {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(String(key), 'utf8'), null);
  return cipher.update(String(data), 'utf8', 'hex').toUpperCase() + cipher.final('hex').toUpperCase();
};

const eapi = (url, object) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : String(object);
  const digest = toMD5(`nobody${url}use${text}md5forencrypt`);
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return { params: aes128EcbHex(data, 'e82ckenh8dichen8') };
};

const PART_1_INDEXES = [23, 14, 6, 36, 16, 40, 7, 19];
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5];
const SCRAMBLE_VALUES = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];

const zzcSign = text => {
  const hash = sha1Hex(text);
  const part1 = PART_1_INDEXES.map(idx => hash[idx]).join('');
  const part2 = PART_2_INDEXES.map(idx => hash[idx]).join('');
  const part3 = SCRAMBLE_VALUES.map((value, i) => value ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16));
  const b64Part = Buffer.from(part3).toString('base64').replace(/[\\/+=]/g, '');
  return `zzc${part1}${b64Part}${part2}`.toLowerCase();
};

const mgSignature = (time, str) => {
  const deviceId = '963B7AA0D21511ED807EE5846EC87D20';
  const signatureMd5 = '6cdc72a439cef99a3418d2a78aa28c73';
  const sign = toMD5(`${str}${signatureMd5}yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${time}`);
  return { sign, deviceId };
};

// ---------------- 工具函数（utils.js 移植） ----------------
const sizeFormate = size => {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const number = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, Math.floor(number))).toFixed(2)} ${units[number]}`;
};

const numFix = n => n < 10 ? (`0${n}`) : n.toString();

const formatPlayTime = time => {
  const m = Math.trunc(time / 60);
  const s = Math.trunc(time % 60);
  return m == 0 && s == 0 ? '--/--' : numFix(m) + ':' + numFix(s);
};

const decodeName = (str = '') => {
  if (!str) return '';
  return String(str)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(parseInt(code, 10)));
};

const formatSingerName = (singers, nameKey = 'name', join = '、') => {
  if (Array.isArray(singers)) {
    const singer = [];
    singers.forEach(item => {
      const name = item[nameKey];
      if (!name) return;
      singer.push(name);
    });
    return decodeName(singer.join(join));
  }
  return decodeName(String(singers ?? ''));
};

const formatSinger = rawData => String(rawData).replace(/&/g, '、');

// ---------------- 各平台搜索（music-sdk/*.js 移植） ----------------
const wySearch = async (str, page = 1) => {
  const limit = 30;
  const body = await httpRequest('http://interface.music.163.com/eapi/batch', {
    method: 'POST',
    form: eapi('/api/search/song/list/page', {
      keyword: str,
      needCorrect: '1',
      channel: 'typing',
      offset: limit * (page - 1),
      scene: 'normal',
      total: page == 1,
      limit,
    }),
    headers: { origin: 'https://music.163.com' },
  });
  const data = body.body;
  if (!data || data.code !== 200) throw new Error(data?.message || '网易云搜索失败');
  const list = (data.data?.resources || []).map(mapWyItem);
  return {
    list,
    allPage: Math.ceil((data.data?.totalCount || 0) / limit),
    total: data.data?.totalCount || 0,
    limit,
    source: 'wy',
  };
};

const mapWyItem = raw => {
  const item = raw.baseInfo.simpleSongData;
  const types = [];
  const _types = {};
  let size;

  if (item.privilege.maxBrLevel == 'hires') {
    size = item.hr ? sizeFormate(item.hr.size) : null;
    types.push({ type: 'flac24bit', size });
    _types.flac24bit = { size };
  }
  switch (item.privilege.maxbr) {
    case 999000:
      size = item.sq ? sizeFormate(item.sq.size) : null;
      types.push({ type: 'flac', size });
      _types.flac = { size };
    // eslint-disable-next-line no-fallthrough
    case 320000:
      size = item.h ? sizeFormate(item.h.size) : null;
      types.push({ type: '320k', size });
      _types['320k'] = { size };
    // eslint-disable-next-line no-fallthrough
    case 192000:
    case 128000:
      size = item.l ? sizeFormate(item.l.size) : null;
      types.push({ type: '128k', size });
      _types['128k'] = { size };
  }
  types.reverse();

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
  };
};

const buildTxComm = () => ({
  ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic', phonetype: 'EBG-AN10',
  deviceScore: '553.47', devicelevel: '50', newdevicelevel: '20',
  rom: 'HuaWei/EMOTION/EmotionUI_14.2.0', os_ver: '12', OpenUDID: '0', OpenUDID2: '0',
  QIMEI36: '0', udid: '0', chid: '0', aid: '0', oaid: '0', taid: '0', tid: '0', wid: '0',
  uid: '0', sid: '0', modeSwitch: '6', teenMode: '0', ui_mode: '2', nettype: '1020', v4ip: '',
});

const buildTxReq = (str, page, limit) => ({
  comm: buildTxComm(),
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
});

const txMusicSearch = async (str, page, limit, retryNum = 0) => {
  const data = buildTxReq(str, page, limit);
  const sign = zzcSign(JSON.stringify(data));
  const resp = await httpRequest(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'User-Agent': 'QQMusic 14090508(android 12)' },
  });
  const body = resp.body;
  if (!body || !body.req || body.code != 0 || body.req.code != 0) {
    if (retryNum > 5) throw new Error('QQ音乐搜索失败');
    return txMusicSearch(str, page, limit, ++retryNum);
  }
  return body.req.data;
};

const txSearch = async (str, page = 1) => {
  const limit = 50;
  const data = await txMusicSearch(str, page, limit);
  const rawList = data?.body?.item_song || [];
  const list = rawList.map(mapTxItem).filter(Boolean);
  const total = data?.meta?.estimate_sum || 0;
  return {
    list,
    allPage: Math.ceil(total / limit),
    total,
    limit,
    source: 'tx',
  };
};

const mapTxItem = item => {
  if (!item.file?.media_mid) return null;

  const types = [];
  const _types = {};
  const file = item.file;
  if (file.size_128mp3 != 0) {
    const size = sizeFormate(file.size_128mp3);
    types.push({ type: '128k', size });
    _types['128k'] = { size };
  }
  if (file.size_320mp3 !== 0) {
    const size = sizeFormate(file.size_320mp3);
    types.push({ type: '320k', size });
    _types['320k'] = { size };
  }
  if (file.size_flac !== 0) {
    const size = sizeFormate(file.size_flac);
    types.push({ type: 'flac', size });
    _types.flac = { size };
  }
  if (file.size_hires !== 0) {
    const size = sizeFormate(file.size_hires);
    types.push({ type: 'flac24bit', size });
    _types.flac24bit = { size };
  }
  let albumId = '';
  let albumName = '';
  if (item.album) {
    albumName = item.album.name;
    albumId = item.album.mid;
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
  };
};

const kwSearch = async (str, page = 1) => {
  const limit = 30;
  const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`;
  const result = await httpRequest(url);
  const body = result.body;
  // 解析失败（body 为 string）时不再静默返回空列表
  if (!body || typeof body === 'string' || (body.TOTAL !== '0' && body.SHOW === '0')) {
    throw new Error('酷我搜索失败');
  }
  const list = handleKwResult(body.abslist);
  const total = parseInt(body.TOTAL) || 0;
  return {
    list,
    allPage: Math.ceil(total / limit),
    total,
    limit,
    source: 'kw',
  };
};

const kwRegExps = { mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/ };

const handleKwResult = rawData => {
  const result = [];
  if (!rawData) return result;
  for (let i = 0; i < rawData.length; i++) {
    const info = rawData[i];
    const songId = String(info.MUSICRID || '').replace('MUSIC_', '');

    if (!info.N_MINFO) continue;

    const types = [];
    const _types = {};

    const infoArr = String(info.N_MINFO).split(';');
    for (const item of infoArr) {
      const mInfo = item.match(kwRegExps.mInfo);
      if (!mInfo) continue;
      switch (mInfo[2]) {
        case '4000':
          types.push({ type: 'flac24bit', size: mInfo[4] });
          _types.flac24bit = { size: mInfo[4].toLocaleUpperCase() };
          break
        case '2000':
          types.push({ type: 'flac', size: mInfo[4] });
          _types.flac = { size: mInfo[4].toLocaleUpperCase() };
          break
        case '320':
          types.push({ type: '320k', size: mInfo[4] });
          _types['320k'] = { size: mInfo[4].toLocaleUpperCase() };
          break
        case '128':
          types.push({ type: '128k', size: mInfo[4] });
          _types['128k'] = { size: mInfo[4].toLocaleUpperCase() };
          break
      }
    }
    types.reverse();

    const interval = parseInt(info.DURATION);

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
    });
  }
  return result;
};

const kgSearch = async (str, page = 1) => {
  const limit = 30;
  const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(str)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
  const resp = await httpRequest(url);
  const result = resp.body;
  if (!result || result.error_code !== 0) throw new Error('酷狗搜索失败');
  const list = handleKgResult(result.data.lists);
  const total = result.data.total || 0;
  return {
    list,
    allPage: Math.ceil(total / limit),
    total,
    limit,
    source: 'kg',
  };
};

const filterKgData = rawData => {
  const types = [];
  const _types = {};
  if (rawData.FileSize !== 0) {
    const size = sizeFormate(rawData.FileSize);
    types.push({ type: '128k', size, hash: rawData.FileHash });
    _types['128k'] = { size, hash: rawData.FileHash };
  }
  if (rawData.HQFileSize !== 0) {
    const size = sizeFormate(rawData.HQFileSize);
    types.push({ type: '320k', size, hash: rawData.HQFileHash });
    _types['320k'] = { size, hash: rawData.HQFileHash };
  }
  if (rawData.SQFileSize !== 0) {
    const size = sizeFormate(rawData.SQFileSize);
    types.push({ type: 'flac', size, hash: rawData.SQFileHash });
    _types.flac = { size, hash: rawData.SQFileHash };
  }
  if (rawData.ResFileSize !== 0) {
    const size = sizeFormate(rawData.ResFileSize);
    types.push({ type: 'flac24bit', size, hash: rawData.ResFileHash });
    _types.flac24bit = { size, hash: rawData.ResFileHash };
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
  };
};

const handleKgResult = rawData => {
  const ids = new Set();
  const list = [];
  (rawData || []).forEach(item => {
    const key = item.Audioid + item.FileHash;
    if (ids.has(key)) return;
    ids.add(key);
    list.push(filterKgData(item));
    for (const childItem of item.Grp || []) {
      const childKey = item.Audioid + childItem.FileHash;
      if (ids.has(childKey)) continue;
      ids.add(childKey);
      list.push(filterKgData(childItem));
    }
  });
  return list;
};

const mgSearch = async (str, page = 1) => {
  const limit = 20;
  const time = Date.now().toString();
  const signData = mgSignature(time, str);
  const { resultList, totalCount } = await doMgSearch(str, page, limit, time, signData);
  const total = parseInt(totalCount) || 0;
  return {
    list: resultList.flatMap(mapMgResult),
    allPage: total ? Math.ceil(total / limit) : 0,
    total,
    limit,
    source: 'mg',
  };
};

const doMgSearch = async (str, page, limit, time, signData) => {
  const url = `https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=0&isCopyright=1&searchSwitch=%7B%22song%22%3A1%2C%22album%22%3A0%2C%22singer%22%3A0%2C%22tagSong%22%3A1%2C%22mvSong%22%3A0%2C%22bestShow%22%3A1%2C%22songlist%22%3A0%2C%22lyricSong%22%3A0%7D&pageSize=${limit}&text=${encodeURIComponent(str)}&pageNo=${page}&sort=0&sid=USS`;
  const resp = await httpRequest(url, {
    headers: {
      uiVersion: 'A_music_3.6.1',
      deviceId: signData.deviceId,
      timestamp: time,
      sign: signData.sign,
      channel: '0146921',
      'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
    },
  });
  const body = resp.body;
  if (!body || body.code !== '000000') throw new Error(body?.info || '咪咕搜索失败');
  const songResultData = body.songResultData || { resultList: [] };
  return { resultList: songResultData.resultList || [], totalCount: songResultData.totalCount };
};

const mapMgResult = rawItems => {
  const list = [];
  const ids = new Set();
  rawItems.forEach(data => {
    if (!data.songId || !data.copyrightId || ids.has(data.copyrightId)) return;
    ids.add(data.copyrightId);

    const types = [];
    const _types = {};
    data.audioFormats && data.audioFormats.forEach(type => {
      let size;
      switch (type.formatType) {
        case 'PQ':
          size = sizeFormate(type.asize ?? type.isize);
          types.push({ type: '128k', size });
          _types['128k'] = { size };
          break
        case 'HQ':
          size = sizeFormate(type.asize ?? type.isize);
          types.push({ type: '320k', size });
          _types['320k'] = { size };
          break
        case 'SQ':
          size = sizeFormate(type.asize ?? type.isize);
          types.push({ type: 'flac', size });
          _types.flac = { size };
          break
        case 'ZQ24':
          size = sizeFormate(type.asize ?? type.isize);
          types.push({ type: 'flac24bit', size });
          _types.flac24bit = { size };
          break
      }
    });

    let img = data.img3 || data.img2 || data.img1 || null;
    if (img && !/https?:/.test(img)) img = 'http://d.musicapp.migu.cn' + img;

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
    });
  });
  return list;
};

// ---------------- 结果归一化（music-sdk/index.js toNewSongInfo 移植） ----------------
const toNewSongInfo = oldMusicInfo => {
  const meta = {
    songId: oldMusicInfo.songmid,
    albumName: oldMusicInfo.albumName,
    picUrl: oldMusicInfo.img,
    qualitys: oldMusicInfo.types,
    _qualitys: oldMusicInfo._types,
    albumId: oldMusicInfo.albumId,
  };
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
  };

  if (oldMusicInfo._qualitys?.flac32bit && !oldMusicInfo._qualitys.flac24bit) {
    meta._qualitys.flac24bit = meta._qualitys.flac32bit;
    delete meta._qualitys.flac32bit;
    meta.qualitys = meta.qualitys.map(quality => {
      if (quality.type == 'flac32bit') quality.type = 'flac24bit';
      return quality;
    });
  }

  switch (oldMusicInfo.source) {
    case 'kg':
      meta.hash = oldMusicInfo.hash;
      newInfo.hash = oldMusicInfo.hash;
      newInfo.id = oldMusicInfo.songmid + '_' + oldMusicInfo.hash;
      break
    case 'tx':
      meta.strMediaMid = oldMusicInfo.strMediaMid;
      meta.id = oldMusicInfo.songId;
      meta.albumMid = oldMusicInfo.albumMid;
      newInfo.songId = oldMusicInfo.songId;
      newInfo.strMediaMid = oldMusicInfo.strMediaMid;
      newInfo.albumMid = oldMusicInfo.albumMid;
      break
    case 'mg':
      meta.copyrightId = oldMusicInfo.copyrightId;
      meta.lrcUrl = oldMusicInfo.lrcUrl;
      meta.mrcUrl = oldMusicInfo.mrcUrl;
      meta.trcUrl = oldMusicInfo.trcUrl;
      newInfo.copyrightId = oldMusicInfo.copyrightId;
      break
  }

  return newInfo;
};

const searchImpls = { wy: wySearch, tx: txSearch, kw: kwSearch, kg: kgSearch, mg: mgSearch };

const isBuiltinSource = sourceId => BUILTIN_SOURCES.includes(sourceId);

const builtinSearch = async (sourceId, keyword, page = 1) => {
  const impl = searchImpls[sourceId];
  if (!impl) throw new Error('Unsupported builtin source: ' + sourceId);
  const result = await impl(keyword, page);
  return {
    ...result,
    list: result.list.filter(Boolean).map(item => toNewSongInfo(item)),
  };
};

module.exports = {
  builtinSearch,
  isBuiltinSource,
  BUILTIN_SOURCES,
  httpRequest,
  toMD5,
  sha1Hex,
  aes128EcbHex,
  eapi,
  zzcSign,
  mgSignature,
  sizeFormate,
  numFix,
  formatPlayTime,
  decodeName,
  formatSingerName,
  formatSinger,
  toNewSongInfo,
};