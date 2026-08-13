// 服务端内置歌单/排行榜 SDK —— 从 lx-music-desktop 官方源码移植（Node CJS 版本）
// 源文件（master 分支，ESM → CJS 忠实转换）：
//   src/renderer/utils/musicSdk/kw/songList.js, kw/leaderboard.js, kw/album.js, kw/util.js
//   src/renderer/utils/musicSdk/kg/songList.js, kg/leaderboard.js, kg/util.js, kg/vendors/infSign.min.js
//   src/renderer/utils/musicSdk/mg/songList.js, mg/leaderboard.js, mg/musicInfo.js, mg/musicSearch.js, mg/utils/index.js
//   src/common/utils/common.ts（dateFormat）, src/renderer/utils/index.ts（formatPlayCount）
// 复用 builtin-sdk.cjs 的工具（httpRequest、toMD5、sizeFormate、formatPlayTime、decodeName、
// formatSingerName、formatSinger、toNewSongInfo、mgSignature、numFix 等）。
const crypto = require('crypto');
const sdk = require('./builtin-sdk.cjs');
const {
  httpRequest,
  toMD5,
  sizeFormate,
  formatPlayTime,
  decodeName,
  formatSingerName,
  formatSinger,
  toNewSongInfo,
  numFix,
  mgSignature,
} = sdk;

// ---------------- 通用工具（src/common/utils/common.ts / src/renderer/utils/index.ts 移植） ----------------
const toDateObj = (date) => {
  // console.log(date)
  if (!date) return '';
  switch (typeof date) {
    case 'string':
      if (!date.includes('T')) date = date.split('.')[0].replace(/-/g, '/');
    // eslint-disable-next-line no-fallthrough
    case 'number':
      date = new Date(date);
    // eslint-disable-next-line no-fallthrough
    case 'object':
      break;
    default: return '';
  }
  return date;
};

const dateFormat = (_date, format = 'Y-M-D h:m:s') => {
  const date = toDateObj(_date);
  if (!date) return '';
  return format
    .replace('Y', date.getFullYear().toString())
    .replace('M', numFix(date.getMonth() + 1))
    .replace('D', numFix(date.getDate()))
    .replace('h', numFix(date.getHours()))
    .replace('m', numFix(date.getMinutes()))
    .replace('s', numFix(date.getSeconds()));
};

/**
 * 格式化播放数量
 * @param {*} num 数字
 */
const formatPlayCount = (num) => {
  if (num > 100000000) return `${Math.trunc(num / 10000000) / 10}亿`;
  if (num > 10000) return `${Math.trunc(num / 1000) / 10}万`;
  return String(num);
};

// 模拟 lx 的 httpFetch（src/renderer/utils/request.js）：返回 { promise, cancelHttp }，
// promise 解析为 { statusCode, headers, body }；服务端无需真正取消请求。
const httpFetch = (url, options) => {
  const promise = httpRequest(url, options);
  return {
    promise,
    cancelHttp() {},
  };
};

// ---------------- kw 工具（src/renderer/utils/musicSdk/kw/util.js 移植） ----------------
const objStr2JSON = str => {
  return JSON.parse(str.replace(/('(?=(,\s*')))|('(?=:))|((?<=([:,]\s*))')|((?<={)')|('(?=}))/g, '"'));
};

const createAesEncrypt = (buffer, mode, key, iv) => {
  const cipher = crypto.createCipheriv(mode, key, iv);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
};

const createAesDecrypt = (buffer, mode, key, iv) => {
  const decipher = crypto.createDecipheriv(mode, key, iv);
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
};

const wbdCrypto = {
  aesMode: 'aes-128-ecb',
  aesKey: Buffer.from([112, 87, 39, 61, 199, 250, 41, 191, 57, 68, 45, 114, 221, 94, 140, 228], 'binary'),
  aesIv: '',
  appId: 'y67sprxhhpws',
  decodeData(base64Result) {
    const data = Buffer.from(decodeURIComponent(base64Result), 'base64');
    return JSON.parse(createAesDecrypt(data, this.aesMode, this.aesKey, this.aesIv).toString());
  },
  createSign(data, time) {
    const str = `${this.appId}${data}${time}`;
    return toMD5(str).toUpperCase();
  },
  buildParam(jsonData) {
    const data = Buffer.from(JSON.stringify(jsonData));
    const time = Date.now();

    const encodeData = createAesEncrypt(data, this.aesMode, this.aesKey, this.aesIv).toString('base64');
    const sign = this.createSign(encodeData, time);

    return `data=${encodeURIComponent(encodeData)}&time=${time}&appId=${this.appId}&sign=${sign}`;
  },
};

// ---------------- kg 工具（src/renderer/utils/musicSdk/kg/util.js 移植） ----------------
/**
 * 签名
 * @param {*} params
 * @param {*} apiver
 */
const signatureParams = (params, platform = 'android', body = '') => {
  let keyparam = 'OIlwieks28dk2k092lksi2UIkp';
  if (platform === 'web') keyparam = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
  const param_list = params.split('&');
  param_list.sort();
  const sign_params = `${keyparam}${param_list.join('')}${body}${keyparam}`;
  return toMD5(sign_params);
};

// kg/vendors/infSign.min.js 的 H5 签名算法等价实现（useH5: true, isCDN: true, 无 post body）。
// 原库在非客户端环境下走同一分支：key = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'，
// isCDN 删除 clienttime/mid/uuid/dfid，参数名排序后 md5(key + k=v... + key)。
const infSignH5 = (params, options = {}) => {
  const key = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
  const isCDN = options.isCDN || false;
  const base = { srcappid: '2919', clientver: '20000', clienttime: Date.now(), mid: Date.now(), uuid: Date.now(), dfid: '-' };
  if (isCDN) {
    delete base.clienttime;
    delete base.mid;
    delete base.uuid;
    delete base.dfid;
  }
  const l = Object.assign({}, base, params);
  const keys = [];
  for (const g in l) keys.push(g);
  keys.sort();
  const joined = keys.map(g => `${g}=${l[g]}`).join('');
  return Object.assign({}, l, { signature: toMD5(key + joined + key) });
};

// ---------------- mg 工具（src/renderer/utils/musicSdk/mg/utils/index.js 移植） ----------------
/**
 * 创建一个适用于MG的Http请求
 * @param {*} url
 * @param {*} options
 * @param {*} retryNum
 */
const createHttpFetch = async (url, options, retryNum = 0) => {
  if (retryNum > 2) throw new Error('try max num');
  let result;
  try {
    result = await httpFetch(url, options).promise;
  } catch (err) {
    console.log(err);
    return createHttpFetch(url, options, ++retryNum);
  }
  if (result.statusCode !== 200 ||
    (
      (result.body.code !== undefined
        ? result.body.code
        : result.body.returnCode !== undefined
          ? result.body.returnCode
          : result.body.code
      ) !== '000000')
  ) return createHttpFetch(url, options, ++retryNum);
  if (result.body.data) return result.body.data;
  return result.body;
};

// ---------------- mg musicInfo（src/renderer/utils/musicSdk/mg/musicInfo.js 移植） ----------------
const createGetMusicInfosTask = (ids) => {
  let list = ids;
  const tasks = [];
  while (list.length) {
    tasks.push(list.slice(0, 100));
    if (list.length < 100) break;
    list = list.slice(100);
  }
  const url = 'https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=2';
  return Promise.all(tasks.map(task => createHttpFetch(url, {
    method: 'POST',
    form: {
      resourceId: task.join('|'),
    },
  }).then(data => data.resource)));
};

const filterMusicInfoList = (rawList) => {
  const ids = new Set();
  const list = [];
  rawList.forEach(item => {
    if (!item.songId || ids.has(item.songId)) return;
    ids.add(item.songId);
    const types = [];
    const _types = {};
    item.newRateFormats?.forEach(type => {
      let size;
      switch (type.formatType) {
        case 'PQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: '128k', size });
          _types['128k'] = {
            size,
          };
          break;
        case 'HQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: '320k', size });
          _types['320k'] = {
            size,
          };
          break;
        case 'SQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: 'flac', size });
          _types.flac = {
            size,
          };
          break;
        case 'ZQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: 'flac24bit', size });
          _types.flac24bit = {
            size,
          };
          break;
      }
    });

    const intervalTest = /(\d\d:\d\d)$/.test(item.length);

    list.push({
      singer: formatSingerName(item.artists, 'name'),
      name: item.songName,
      albumName: item.album,
      albumId: item.albumId,
      songmid: item.songId,
      copyrightId: item.copyrightId,
      source: 'mg',
      interval: intervalTest ? RegExp.$1 : null,
      img: item.albumImgs?.length ? item.albumImgs[0].img : null,
      lrc: null,
      lrcUrl: item.lrcUrl,
      mrcUrl: item.mrcUrl,
      trcUrl: item.trcUrl,
      otherSource: null,
      types,
      _types,
      typeUrl: {},
    });
  });
  return list;
};

const filterMusicInfoListV5 = (rawList) => {
  const ids = new Set();
  const list = [];
  rawList.forEach(item => {
    if (!item.songId || ids.has(item.songId)) return;
    ids.add(item.songId);
    const types = [];
    const _types = {};
    item.audioFormats?.forEach(type => {
      let size;
      switch (type.formatType) {
        case 'PQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: '128k', size });
          _types['128k'] = {
            size,
          };
          break;
        case 'HQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: '320k', size });
          _types['320k'] = {
            size,
          };
          break;
        case 'SQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: 'flac', size });
          _types.flac = {
            size,
          };
          break;
        case 'ZQ':
          size = sizeFormate(type.size ?? type.androidSize);
          types.push({ type: 'flac24bit', size });
          _types.flac24bit = {
            size,
          };
          break;
      }
    });

    list.push({
      singer: formatSingerName(item.singerList, 'name'),
      name: item.songName,
      albumName: item.album,
      albumId: item.albumId,
      songmid: item.songId,
      copyrightId: item.copyrightId,
      source: 'mg',
      interval: formatPlayTime(item.duration),
      img: item.img3 || item.img2 || item.img1 || null,
      lrc: null,
      lrcUrl: item.lrcUrl,
      mrcUrl: item.mrcUrl,
      trcUrl: item.trcUrl,
      otherSource: null,
      types,
      _types,
      typeUrl: {},
    });
  });
  return list;
};

// ==================== kw 歌单（src/renderer/utils/musicSdk/kw/songList.js 移植） ====================
const kwSongList = {
  _requestObj_tags: null,
  _requestObj_hotTags: null,
  _requestObj_list: null,
  limit_list: 36,
  limit_song: 1000,
  successCode: 200,
  sortList: [
    {
      name: '最新',
      id: 'new',
    },
    {
      name: '最热',
      id: 'hot',
    },
  ],
  regExps: {
    mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/,
    // http://www.kuwo.cn/playlist_detail/2886046289
    // https://m.kuwo.cn/h5app/playlist/2736267853?t=qqfriend
    listDetailLink: /^.+\/playlist(?:_detail)?\/(\d+)(?:\?.*|&.*$|#.*$|$)/,
  },
  tagsUrl: 'http://wapi.kuwo.cn/api/pc/classify/playlist/getTagList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0&vipver=9.0.5.0&source=kwplayer_pc_9.0.5.0&loginUid=0&loginSid=0&appUid=76039576',
  hotTagUrl: 'http://wapi.kuwo.cn/api/pc/classify/playlist/getRcmTagList?loginUid=0&loginSid=0&appUid=76039576',
  getListUrl({ sortId, id, type, page }) {
    if (!id) return `http://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?loginUid=0&loginSid=0&appUid=76039576&&pn=${page}&rn=${this.limit_list}&order=${sortId}`;
    switch (type) {
      case '10000': return `http://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList?loginUid=0&loginSid=0&appUid=76039576&pn=${page}&id=${id}&rn=${this.limit_list}`;
      case '43': return `http://mobileinterfaces.kuwo.cn/er.s?type=get_pc_qz_data&f=web&id=${id}&prod=pc`;
    }
    // http://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList?loginUid=0&loginSid=0&appUid=76039576&id=173&pn=1&rn=100
  },
  getListDetailUrl(id, page) {
    // http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=2858093057&pn=0&rn=100&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1
    return `http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=${id}&pn=${page - 1}&rn=${this.limit_song}&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1`;
    // http://mobileinterfaces.kuwo.cn/er.s?type=get_pc_qz_data&f=web&id=140&prod=pc
  },

  // http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=2849349915&pn=0&rn=100&encode=utf8&keyset=pl2012&identity=kuwo&pcmp4=1&vipver=MUSIC_9.0.5.0_W1&newver=1
  // 获取标签
  getTag(tryNum = 0) {
    if (this._requestObj_tags) this._requestObj_tags.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_tags = httpFetch(this.tagsUrl);
    return this._requestObj_tags.promise.then(({ body }) => {
      if (body.code !== this.successCode) return this.getTag(++tryNum);
      return this.filterTagInfo(body.data);
    });
  },
  // 获取标签
  getHotTag(tryNum = 0) {
    if (this._requestObj_hotTags) this._requestObj_hotTags.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_hotTags = httpFetch(this.hotTagUrl);
    return this._requestObj_hotTags.promise.then(({ body }) => {
      if (body.code !== this.successCode) return this.getHotTag(++tryNum);
      return this.filterInfoHotTag(body.data[0].data);
    });
  },
  filterInfoHotTag(rawList) {
    return rawList.map(item => ({
      id: `${item.id}-${item.digest}`,
      name: item.name,
      source: 'kw',
    }));
  },
  filterTagInfo(rawList) {
    return rawList.map(type => ({
      name: type.name,
      list: type.data.map(item => ({
        parent_id: type.id,
        parent_name: type.name,
        id: `${item.id}-${item.digest}`,
        name: item.name,
        source: 'kw',
      })),
    }));
  },

  // 获取列表数据
  getList(sortId, tagId, page, tryNum = 0) {
    if (this._requestObj_list) this._requestObj_list.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    let id;
    let type;
    if (tagId) {
      const arr = tagId.split('-');
      id = arr[0];
      type = arr[1];
    } else {
      id = null;
    }
    this._requestObj_list = httpFetch(this.getListUrl({ sortId, id, type, page }));
    return this._requestObj_list.promise.then(({ body }) => {
      if (!id || type == '10000') {
        if (body.code !== this.successCode) return this.getList(sortId, tagId, page, ++tryNum);
        return {
          list: this.filterList(body.data.data),
          total: body.data.total,
          page: body.data.pn,
          limit: body.data.rn,
          source: 'kw',
        };
      } else if (!body.length) {
        return this.getList(sortId, tagId, page, ++tryNum);
      }
      return {
        list: this.filterList2(body),
        total: 1000,
        page,
        limit: 1000,
        source: 'kw',
      };
    });
  },

  /**
   * 格式化播放数量
   * @param {*} num
   */
  formatPlayCount(num) {
    if (num > 100000000) return parseInt(num / 10000000) / 10 + '亿';
    if (num > 10000) return parseInt(num / 1000) / 10 + '万';
    return num;
  },
  filterList(rawData) {
    return rawData.map(item => ({
      play_count: this.formatPlayCount(item.listencnt),
      id: `digest-${item.digest}__${item.id}`,
      author: item.uname,
      name: item.name,
      // time: item.publish_time,
      total: item.total,
      img: item.img,
      grade: item.favorcnt / 10,
      desc: item.desc,
      source: 'kw',
    }));
  },
  filterList2(rawData) {
    const list = [];
    rawData.forEach(item => {
      if (!item.label) return;
      list.push(...item.list.map(item => ({
        play_count: item.play_count && this.formatPlayCount(item.listencnt),
        id: `digest-${item.digest}__${item.id}`,
        author: item.uname,
        name: item.name,
        total: item.total,
        // time: item.publish_time,
        img: item.img,
        grade: item.favorcnt && item.favorcnt / 10,
        desc: item.desc,
        source: 'kw',
      })));
    });
    return list;
  },

  getListDetailDigest8(id, page, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'));

    const requestObj = httpFetch(this.getListDetailUrl(id, page));
    return requestObj.promise.then(({ body }) => {
      if (body.result !== 'ok') return this.getListDetail(id, page, ++tryNum);
      return {
        list: this.filterListDetail(body.musiclist),
        page,
        limit: body.rn,
        total: body.total,
        source: 'kw',
        info: {
          name: body.title,
          img: body.pic,
          desc: body.info,
          author: body.uname,
          play_count: this.formatPlayCount(body.playnum),
        },
      };
    });
  },
  getListDetailDigest5Info(id, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    const requestObj = httpFetch(`http://qukudata.kuwo.cn/q.k?op=query&cont=ninfo&node=${id}&pn=0&rn=1&fmt=json&src=mbox&level=2`);
    return requestObj.promise.then(({ statusCode, body }) => {
      if (statusCode != 200 || !body.child) return this.getListDetail(id, ++tryNum);
      // console.log(body)
      return body.child.length ? body.child[0].sourceid : null;
    });
  },
  getListDetailDigest5Music(id, page, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    const requestObj = httpFetch(`http://nplserver.kuwo.cn/pl.svc?op=getlistinfo&pid=${id}&pn=${page - 1}}&rn=${this.limit_song}&encode=utf-8&keyset=pl2012&identity=kuwo&pcmp4=1`);
    return requestObj.promise.then(({ body }) => {
      // console.log(body)
      if (body.result !== 'ok') return this.getListDetail(id, page, ++tryNum);
      return {
        list: this.filterListDetail(body.musiclist),
        page,
        limit: body.rn,
        total: body.total,
        source: 'kw',
        info: {
          name: body.title,
          img: body.pic,
          desc: body.info,
          author: body.uname,
          play_count: this.formatPlayCount(body.playnum),
        },
      };
    });
  },
  async getListDetailDigest5(id, page, retryNum) {
    const detailId = await this.getListDetailDigest5Info(id, retryNum);
    return this.getListDetailDigest5Music(detailId, page, retryNum);
  },

  filterBDListDetail(rawList) {
    return rawList.map(item => {
      const types = [];
      const _types = {};
      for (const info of item.audios) {
        info.size = info.size?.toLocaleUpperCase();
        switch (info.bitrate) {
          case '4000':
            types.push({ type: 'flac24bit', size: info.size });
            _types.flac24bit = {
              size: info.size,
            };
            break;
          case '2000':
            types.push({ type: 'flac', size: info.size });
            _types.flac = {
              size: info.size,
            };
            break;
          case '320':
            types.push({ type: '320k', size: info.size });
            _types['320k'] = {
              size: info.size,
            };
            break;
          case '128':
            types.push({ type: '128k', size: info.size });
            _types['128k'] = {
              size: info.size,
            };
            break;
        }
      }
      types.reverse();

      return {
        singer: item.artists.map(s => s.name).join('、'),
        name: item.name,
        albumName: item.album,
        albumId: item.albumId,
        songmid: item.id,
        source: 'kw',
        interval: formatPlayTime(item.duration),
        img: item.albumPic,
        releaseDate: item.releaseDate,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      };
    });
  },
  getReqId() {
    function t() {
      return (65536 * (1 + Math.random()) | 0).toString(16).substring(1);
    }
    return t() + t() + t() + t() + t() + t() + t() + t();
  },
  async getListDetailMusicListByBDListInfo(id, source) {
    const { body: infoData } = await httpFetch(`https://bd-api.kuwo.cn/api/service/playlist/info/${id}?reqId=${this.getReqId()}&source=${source}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
        plat: 'h5',
      },
    }).promise.catch(() => ({ code: 0 }));

    if (infoData.code != 200) return null;

    return {
      name: infoData.data.name,
      img: infoData.data.pic,
      desc: infoData.data.description,
      author: infoData.data.creatorName,
      play_count: infoData.data.playNum,
    };
  },
  async getListDetailMusicListByBDUserPub(id) {
    const { body: infoData } = await httpFetch(`https://bd-api.kuwo.cn/api/ucenter/users/pub/${id}?reqId=${this.getReqId()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
        plat: 'h5',
      },
    }).promise.catch(() => ({ code: 0 }));

    if (infoData.code != 200) return null;

    // console.log(infoData)
    return {
      name: infoData.data.userInfo.nickname + '喜欢的音乐',
      img: infoData.data.userInfo.headImg,
      desc: '',
      author: infoData.data.userInfo.nickname,
      play_count: '',
    };
  },
  async getListDetailMusicListByBDList(id, source, page, tryNum = 0) {
    const { body: listData } = await httpFetch(`https://bd-api.kuwo.cn/api/service/playlist/${id}/musicList?reqId=${this.getReqId()}&source=${source}&pn=${page}&rn=${this.limit_song}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
        plat: 'h5',
      },
    }).promise.catch(() => {
      if (tryNum > 2) return Promise.reject(new Error('try max num'));
      return this.getListDetailMusicListByBDList(id, source, page, ++tryNum);
    });

    if (listData.code !== 200) return Promise.reject(new Error('failed'));

    return {
      list: this.filterBDListDetail(listData.data.list),
      page,
      limit: listData.data.pageSize,
      total: listData.data.total,
      source: 'kw',
    };
  },
  async getListDetailMusicListByBD(id, page) {
    const uid = /uid=(\d+)/.exec(id)?.[1];
    const listId = /playlistId=(\d+)/.exec(id)?.[1];
    const source = /source=(\d+)/.exec(id)?.[1];
    if (!listId) return Promise.reject(new Error('failed'));

    const task = [this.getListDetailMusicListByBDList(listId, source, page)];
    switch (source) {
      case '4':
        task.push(this.getListDetailMusicListByBDListInfo(listId, source));
        break;
      case '5':
        task.push(this.getListDetailMusicListByBDUserPub(uid ?? listId));
        break;
    }
    const [listData, info] = await Promise.all(task);
    listData.info = info ?? {
      name: '',
      img: '',
      desc: '',
      author: '',
      play_count: '',
    };
    // console.log(listData)
    return listData;
  },

  // 获取歌曲列表内的音乐
  getListDetail(id, page, retryNum = 0) {
    // console.log(id)
    // https://h5app.kuwo.cn/m/bodian/collection.html?uid=000&playlistId=000&source=5&ownerId=000
    // https://h5app.kuwo.cn/m/bodian/collection.html?uid=000&playlistId=000&source=4&ownerId=
    if (/\/bodian\//.test(id)) return this.getListDetailMusicListByBD(id, page);
    if ((/[?&:/]/.test(id))) id = id.replace(this.regExps.listDetailLink, '$1');
    else if (/^digest-/.test(id)) {
      let [digest, _id] = id.split('__');
      digest = digest.replace('digest-', '');
      id = _id;
      switch (digest) {
        case '8':
          break;
        case '13': return kwAlbum.getAlbumListDetail(id, page, retryNum);
        case '5':
        default: return this.getListDetailDigest5(id, page, retryNum);
      }
    }
    return this.getListDetailDigest8(id, page, retryNum);
  },
  filterListDetail(rawData) {
    // console.log(rawData)
    return rawData.map(item => {
      const infoArr = item.N_MINFO.split(';');
      const types = [];
      const _types = {};
      for (const info of infoArr) {
        const matchInfo = info.match(this.regExps.mInfo);
        if (matchInfo) {
          switch (matchInfo[2]) {
            case '4000':
              types.push({ type: 'flac24bit', size: matchInfo[4] });
              _types.flac24bit = {
                size: matchInfo[4].toLocaleUpperCase(),
              };
              break;
            case '2000':
              types.push({ type: 'flac', size: matchInfo[4] });
              _types.flac = {
                size: matchInfo[4].toLocaleUpperCase(),
              };
              break;
            case '320':
              types.push({ type: '320k', size: matchInfo[4] });
              _types['320k'] = {
                size: matchInfo[4].toLocaleUpperCase(),
              };
              break;
            case '128':
              types.push({ type: '128k', size: matchInfo[4] });
              _types['128k'] = {
                size: matchInfo[4].toLocaleUpperCase(),
              };
              break;
          }
        }
      }
      types.reverse();

      return {
        singer: formatSinger(decodeName(item.artist)),
        name: decodeName(item.name),
        albumName: decodeName(item.album),
        albumId: item.albumid,
        songmid: item.id,
        source: 'kw',
        interval: formatPlayTime(parseInt(item.duration)),
        img: null,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      };
    });
  },
  getTags() {
    return Promise.all([this.getTag(), this.getHotTag()]).then(([tags, hotTag]) => ({ tags, hotTag, source: 'kw' }));
  },
  getDetailPageUrl(id) {
    if ((/[?&:/]/.test(id))) id = id.replace(this.regExps.listDetailLink, '$1');
    else if (/^digest-/.test(id)) {
      const result = id.split('__');
      id = result[1];
    }
    return `http://www.kuwo.cn/playlist_detail/${id}`;
  },

  search(text, page, limit = 20) {
    return httpFetch(`http://search.kuwo.cn/r.s?all=${encodeURIComponent(text)}&pn=${page - 1}&rn=${limit}&rformat=json&encoding=utf8&ver=mbox&vipver=MUSIC_8.7.7.0_BCS37&plat=pc&devid=28156413&ft=playlist&pay=0&needliveshow=0`)
      .promise.then(({ body }) => {
        body = objStr2JSON(body);
        // console.log(body)
        return {
          list: body.abslist.map(item => {
            return {
              play_count: this.formatPlayCount(item.playcnt),
              id: String(item.playlistid),
              author: decodeName(item.nickname),
              name: decodeName(item.name),
              total: item.songnum,
              // time: item.publish_time,
              img: item.pic,
              desc: decodeName(item.intro),
              source: 'kw',
            };
          }),
          limit,
          total: parseInt(body.TOTAL),
          source: 'kw',
        };
      });
  },
};

// ---------------- kw 专辑（src/renderer/utils/musicSdk/kw/album.js 移植，kw 歌单 digest-13 依赖） ----------------
const kwAlbum = {
  limit_list: 36,
  limit_song: 1000,
  filterListDetail(rawList, albumName, albumId) {
    // console.log(rawList)
    return rawList.map(item => {
      const formats = item.formats.split('|');
      const types = [];
      const _types = {};
      if (formats.includes('MP3128')) {
        types.push({ type: '128k', size: null });
        _types['128k'] = {
          size: null,
        };
      }
      if (formats.includes('MP3H')) {
        types.push({ type: '320k', size: null });
        _types['320k'] = {
          size: null,
        };
      }
      if (formats.includes('ALFLAC')) {
        types.push({ type: 'flac', size: null });
        _types.flac = {
          size: null,
        };
      }
      if (formats.includes('HIRFLAC')) {
        types.push({ type: 'flac24bit', size: null });
        _types.flac24bit = {
          size: null,
        };
      }
      return {
        singer: formatSinger(decodeName(item.artist)),
        name: decodeName(item.name),
        albumName,
        albumId,
        songmid: item.id,
        source: 'kw',
        interval: null,
        img: item.pic,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      };
    });
  },
  /**
   * 格式化播放数量
   * @param {*} num
   */
  formatPlayCount(num) {
    if (num > 100000000) return parseInt(num / 10000000) / 10 + '亿';
    if (num > 10000) return parseInt(num / 1000) / 10 + '万';
    return num;
  },
  getAlbumListDetail(id, page, retryNum = 0) {
    if (retryNum > 2) return Promise.reject(new Error('try max num'));
    const requestObj_listDetail = httpFetch(`http://search.kuwo.cn/r.s?pn=${page - 1}&rn=${this.limit_song}&stype=albuminfo&albumid=${id}&show_copyright_off=0&encoding=utf&vipver=MUSIC_9.1.0`);
    return requestObj_listDetail.promise.then(({ statusCode, body }) => {
      if (statusCode !== 200) return this.getAlbumListDetail(id, page, ++retryNum);
      body = objStr2JSON(body);
      // console.log(body)
      if (!body.musiclist) return this.getAlbumListDetail(id, page, ++retryNum);
      body.name = decodeName(body.name);
      return {
        list: this.filterListDetail(body.musiclist, body.name, body.albumid),
        page,
        limit: this.limit_song,
        total: parseInt(body.songnum),
        source: 'kw',
        info: {
          name: body.name,
          img: body.img || body.hts_img,
          desc: decodeName(body.info),
          author: decodeName(body.artist),
          // play_count: this.formatPlayCount(body.playnum),
        },
      };
    });
  },
};

// ==================== kg 排行榜（src/renderer/utils/musicSdk/kg/leaderboard.js 移植） ====================
const kgBoardList = [
  { id: 'kg__8888', name: 'TOP500', bangid: '8888' },
  { id: 'kg__6666', name: '飙升榜', bangid: '6666' },
  { id: 'kg__59703', name: '蜂鸟流行音乐榜', bangid: '59703' },
  { id: 'kg__52144', name: '抖音热歌榜', bangid: '52144' },
  { id: 'kg__52767', name: '快手热歌榜', bangid: '52767' },
  { id: 'kg__24971', name: 'DJ热歌榜', bangid: '24971' },
  { id: 'kg__23784', name: '网络红歌榜', bangid: '23784' },
  { id: 'kg__44412', name: '说唱先锋榜', bangid: '44412' },
  { id: 'kg__31308', name: '内地榜', bangid: '31308' },
  { id: 'kg__33160', name: '电音榜', bangid: '33160' },
  { id: 'kg__31313', name: '香港地区榜', bangid: '31313' },
  { id: 'kg__51341', name: '民谣榜', bangid: '51341' },
  { id: 'kg__54848', name: '台湾地区榜', bangid: '54848' },
  { id: 'kg__31310', name: '欧美榜', bangid: '31310' },
  { id: 'kg__33162', name: 'ACG新歌榜', bangid: '33162' },
  { id: 'kg__31311', name: '韩国榜', bangid: '31311' },
  { id: 'kg__31312', name: '日本榜', bangid: '31312' },
  { id: 'kg__49225', name: '80后热歌榜', bangid: '49225' },
  { id: 'kg__49223', name: '90后热歌榜', bangid: '49223' },
  { id: 'kg__49224', name: '00后热歌榜', bangid: '49224' },
  { id: 'kg__33165', name: '粤语金曲榜', bangid: '33165' },
  { id: 'kg__33166', name: '欧美金曲榜', bangid: '33166' },
  { id: 'kg__33163', name: '影视金曲榜', bangid: '33163' },
  { id: 'kg__51340', name: '伤感榜', bangid: '51340' },
  { id: 'kg__35811', name: '会员专享榜', bangid: '35811' },
  { id: 'kg__37361', name: '雷达榜', bangid: '37361' },
  { id: 'kg__21101', name: '分享榜', bangid: '21101' },
  { id: 'kg__46910', name: '综艺新歌榜', bangid: '46910' },
  { id: 'kg__30972', name: '酷狗音乐人原创榜', bangid: '30972' },
  { id: 'kg__60170', name: '闽南语榜', bangid: '60170' },
  { id: 'kg__65234', name: '儿歌榜', bangid: '65234' },
  { id: 'kg__4681', name: '美国BillBoard榜', bangid: '4681' },
  { id: 'kg__25028', name: 'Beatport电子舞曲榜', bangid: '25028' },
  { id: 'kg__4680', name: '英国单曲榜', bangid: '4680' },
  { id: 'kg__38623', name: '韩国Melon音乐榜', bangid: '38623' },
  { id: 'kg__42807', name: 'joox本地热歌榜', bangid: '42807' },
  { id: 'kg__36107', name: '小语种热歌榜', bangid: '36107' },
  { id: 'kg__4673', name: '日本公信榜', bangid: '4673' },
  { id: 'kg__46868', name: '日本SPACE SHOWER榜', bangid: '46868' },
  { id: 'kg__42808', name: 'KKBOX风云榜', bangid: '42808' },
  { id: 'kg__60171', name: '越南语榜', bangid: '60171' },
  { id: 'kg__60172', name: '泰语榜', bangid: '60172' },
  { id: 'kg__59895', name: 'R&B榜', bangid: '59895' },
  { id: 'kg__59896', name: '摇滚榜', bangid: '59896' },
  { id: 'kg__59897', name: '爵士榜', bangid: '59897' },
  { id: 'kg__59898', name: '乡村音乐榜', bangid: '59898' },
  { id: 'kg__59900', name: '纯音乐榜', bangid: '59900' },
  { id: 'kg__59899', name: '古典榜', bangid: '59899' },
  { id: 'kg__22603', name: '5sing音乐榜', bangid: '22603' },
  { id: 'kg__21335', name: '繁星音乐榜', bangid: '21335' },
  { id: 'kg__33161', name: '古风新歌榜', bangid: '33161' },
];

const kgLeaderboard = {
  listDetailLimit: 100,
  list: [
    { id: 'kgtop500', name: 'TOP500', bangid: '8888' },
    { id: 'kgwlhgb', name: '网络榜', bangid: '23784' },
    { id: 'kgbsb', name: '飙升榜', bangid: '6666' },
    { id: 'kgfxb', name: '分享榜', bangid: '21101' },
    { id: 'kgcyyb', name: '纯音乐榜', bangid: '33164' },
    { id: 'kggfjqb', name: '古风榜', bangid: '33161' },
    { id: 'kgyyjqb', name: '粤语榜', bangid: '33165' },
    { id: 'kgomjqb', name: '欧美榜', bangid: '33166' },
    { id: 'kgdyrgb', name: '电音榜', bangid: '33160' },
    { id: 'kgjdrgb', name: 'DJ热歌榜', bangid: '24971' },
    { id: 'kghyxgb', name: '华语新歌榜', bangid: '31308' },
  ],
  getUrl(p, id, limit) {
    return `http://mobilecdnbj.kugou.com/api/v3/rank/song?version=9108&ranktype=1&plat=0&pagesize=${limit}&area_code=1&page=${p}&rankid=${id}&with_res_tag=0&show_portrait_mv=1`;
  },
  regExps: {
    total: /total: '(\d+)',/,
    page: /page: '(\d+)',/,
    limit: /pagesize: '(\d+)',/,
    listData: /global\.features = (\[.+\]);/,
  },
  _requestBoardsObj: null,
  getBoardsData() {
    if (this._requestBoardsObj) this._requestBoardsObj.cancelHttp();
    this._requestBoardsObj = httpFetch('http://mobilecdnbj.kugou.com/api/v5/rank/list?version=9108&plat=0&showtype=2&parentid=0&apiver=6&area_code=1&withsong=1');
    return this._requestBoardsObj.promise;
  },
  getData(url) {
    const requestDataObj = httpFetch(url);
    return requestDataObj.promise;
  },
  getSinger(singers) {
    const arr = [];
    singers.forEach(singer => {
      arr.push(singer.author_name);
    });
    return arr.join('、');
  },
  filterData(rawList) {
    // console.log(rawList)
    return rawList.map(item => {
      const types = [];
      const _types = {};
      if (item.filesize !== 0) {
        const size = sizeFormate(item.filesize);
        types.push({ type: '128k', size, hash: item.hash });
        _types['128k'] = {
          size,
          hash: item.hash,
        };
      }
      if (item['320filesize'] !== 0) {
        const size = sizeFormate(item['320filesize']);
        types.push({ type: '320k', size, hash: item['320hash'] });
        _types['320k'] = {
          size,
          hash: item['320hash'],
        };
      }
      if (item.sqfilesize !== 0) {
        const size = sizeFormate(item.sqfilesize);
        types.push({ type: 'flac', size, hash: item.sqhash });
        _types.flac = {
          size,
          hash: item.sqhash,
        };
      }
      if (item.filesize_high !== 0) {
        const size = sizeFormate(item.filesize_high);
        types.push({ type: 'flac24bit', size, hash: item.hash_high });
        _types.flac24bit = {
          size,
          hash: item.hash_high,
        };
      }
      return {
        singer: formatSingerName(item.authors, 'author_name'),
        name: decodeName(item.songname),
        albumName: decodeName(item.remark),
        albumId: item.album_id,
        songmid: item.audio_id,
        source: 'kg',
        interval: formatPlayTime(item.duration),
        img: null,
        lrc: null,
        hash: item.hash,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      };
    });
  },
  filterBoardsData(rawList) {
    // console.log(rawList)
    const list = [];
    for (const board of rawList) {
      if (board.isvol != 1) continue;
      list.push({
        id: 'kg__' + board.rankid,
        name: board.rankname,
        bangid: String(board.rankid),
      });
    }
    return list;
  },
  async getBoards(retryNum = 0) {
    // 动态获取榜单接口已失效，固定返回内置榜单（同官方客户端行为）
    this.list = kgBoardList;
    return {
      list: kgBoardList,
      source: 'kg',
    };
  },
  async getList(bangid, page, retryNum = 0) {
    if (++retryNum > 3) throw new Error('try max num');
    const { body } = await this.getData(this.getUrl(page, bangid, this.listDetailLimit));

    if (body.errcode != 0) return this.getList(bangid, page, retryNum);

    // console.log(body)
    const total = body.data.total;
    const limit = 100;
    const listData = this.filterData(body.data.info);
    // console.log(listData)
    return {
      total,
      list: listData,
      limit,
      page,
      source: 'kg',
    };
  },
  getDetailPageUrl(id) {
    if (typeof id == 'string') id = id.replace('kg__', '');
    return `https://www.kugou.com/yy/rank/home/1-${id}.html`;
  },
};

// ==================== mg 歌单（src/renderer/utils/musicSdk/mg/songList.js 移植） ====================
const mgSongList = {
  _requestObj_tags: null,
  _requestObj_list: null,
  limit_list: 30,
  limit_song: 50,
  successCode: '000000',
  cachedDetailInfo: {},
  cachedUrl: {},
  sortList: [
    {
      name: '推荐',
      id: '15127315',
    },
  ],
  regExps: {
    list: /<li><div class="thumb">.+?<\/li>/g,
    listInfo: /.+data-original="(.+?)".*data-id="(\d+)".*<div class="song-list-name"><a\s.*?>(.+?)<\/a>.+<i class="iconfont cf-bofangliang"><\/i>(.+?)<\/div>/,

    // https://music.migu.cn/v3/music/playlist/161044573?page=1
    listDetailLink: /^.+\/playlist\/(\d+)(?:\?.*|&.*$|#.*$|$)/,
  },
  tagsUrl: 'https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-taglist/release',
  getSongListUrl(sortId, tagId, page) {
    if (!tagId) {
      return `https://app.c.nf.migu.cn/pc/bmw/page-data/playlist-square-recommend/v1.0?templateVersion=2&pageNo=${page}`;
    }
    return `https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-listbytag/release?pageNumber=${page}&templateVersion=2&tagId=${tagId}`;
  },
  getSongListDetailUrl(id, page) {
    return `https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0?pageNo=${page}&pageSize=${this.limit_song}&playlistId=${id}`;
  },
  defaultHeaders: {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
    Referer: 'https://m.music.migu.cn/',
  },

  getListDetailList(id, page, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'));

    const requestObj_listDetail = httpFetch(this.getSongListDetailUrl(id, page), { headers: this.defaultHeaders });
    return requestObj_listDetail.promise.then(({ body }) => {
      if (body.code !== this.successCode) return this.getListDetailList(id, page, ++tryNum);
      // console.log(JSON.stringify(body))
      return {
        list: filterMusicInfoListV5(body.data.songList),
        page,
        limit: this.limit_song,
        total: body.data.totalCount,
        source: 'mg',
      };
    });
  },

  getListDetailInfo(id, tryNum = 0) {
    if (tryNum > 2) return Promise.reject(new Error('try max num'));

    if (this.cachedDetailInfo[id]) return Promise.resolve(this.cachedDetailInfo[id]);
    const requestObj_listDetailInfo = httpFetch(`https://c.musicapp.migu.cn/MIGUM3.0/resource/playlist/v2.0?playlistId=${id}`, {
      headers: this.defaultHeaders,
    });
    return requestObj_listDetailInfo.promise.then(({ body }) => {
      if (body.code !== this.successCode) return this.getListDetail(id, ++tryNum);
      // console.log(JSON.stringify(body))
      const cachedDetailInfo = this.cachedDetailInfo[id] = {
        name: body.data.title,
        img: body.data.imgItem.img,
        desc: body.data.summary,
        author: body.data.ownerName,
        play_count: formatPlayCount(body.data.opNumItem.playNum),
      };
      return cachedDetailInfo;
    });
  },

  async getDetailUrl(link, page, retryNum = 0) {
    if (retryNum > 3) return Promise.reject(new Error('link try max num'));

    const requestObj_listDetailLink = httpFetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
        Referer: link,
      },
    });
    const { headers: { location }, statusCode } = await requestObj_listDetailLink.promise;
    // console.log(body, location)
    if (statusCode > 400) return this.getDetailUrl(link, page, ++retryNum);
    if (location) {
      this.cachedUrl[link] = location;
      return this.getListDetail(location, page);
    }
    return Promise.reject(new Error('link get failed'));
  },

  getListDetail(id, page, retryNum = 0) { // 获取歌曲列表内的音乐
    // https://h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=184187437&channel=0146921
    // http://c.migu.cn/00bTY6?ifrom=babddaadfde4ebeda289d671ab62f236
    // https://music.migu.cn/v5/#/playlist?playlistId=221573417
    if (/\/playlist[/?]/.test(id)) {
      id = /(?:playlistId|id)=(\d+)/.exec(id)?.[1];
      if (!id) throw new Error('list detail id parse failed');
    } else if (this.regExps.listDetailLink.test(id)) {
      id = id.replace(this.regExps.listDetailLink, '$1');
    } else if ((/[?&:/]/.test(id))) {
      const url = this.cachedUrl[id];
      return url ? this.getListDetail(url, page) : this.getDetailUrl(id, page);
    }

    return Promise.all([
      this.getListDetailList(id, page, retryNum),
      this.getListDetailInfo(id, retryNum),
    ]).then(([listData, info]) => {
      listData.info = info;
      return listData;
    });
  },

  // 获取列表数据
  getList(sortId, tagId, page, tryNum = 0) {
    if (this._requestObj_list) this._requestObj_list.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_list = httpFetch(this.getSongListUrl(sortId, tagId, page), {
      headers: this.defaultHeaders,
    });
    return this._requestObj_list.promise.then(({ body }) => {
      // console.log(body)
      if (body.code !== '000000') return this.getList(sortId, tagId, page, ++tryNum);
      const list = body.data.contents ? this.filterList2(body.data.contents) : this.filterList(body.data.contentItemList[1].itemList);
      return {
        list,
        total: 99999,
        page,
        limit: this.limit_list,
        source: 'mg',
      };
    });
  },
  filterList2(listData, list = [], ids = new Set()) {
    for (const item of listData) {
      if (item.contents) this.filterList2(item.contents, list, ids);
      else if (item.resType == '2021' && !ids.has(item.resId)) {
        ids.add(item.resId);
        list.push({
          id: String(item.resId),
          author: '',
          name: item.txt,
          // time: dateFormat(item.createTime, 'Y-M-D'),
          img: item.img,
          // grade: item.grade,
          // total: item.contentCount,
          desc: item.txt2,
          source: 'mg',
        });
      }
    }
    return list;
  },
  filterList(rawData) {
    // console.log(rawData)
    return rawData.map(item => ({
      play_count: item.barList[0]?.title,
      id: String(item.logEvent.contentId),
      author: '',
      name: item.title,
      // time: dateFormat(item.createTime, 'Y-M-D'),
      img: item.imageUrl,
      // grade: item.grade,
      // total: item.contentCount,
      desc: '',
      source: 'mg',
    }));
  },

  // 获取标签
  getTag(tryNum = 0) {
    if (this._requestObj_tags) this._requestObj_tags.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_tags = httpFetch(this.tagsUrl, { headers: this.defaultHeaders });
    return this._requestObj_tags.promise.then(({ body }) => {
      if (body.code !== this.successCode) return this.getTag(++tryNum);
      // console.log(body)
      return this.filterTagInfo(body.data);
    });
  },
  filterTagInfo(rawList) {
    return {
      hotTag: rawList[0].content.map(({ texts: [name, id] }) => ({
        id,
        name,
        source: 'mg',
      })),
      tags: rawList.slice(1).map(({ header, content }) => ({
        name: header.title,
        list: content.map(({ texts: [name, id] }) => ({
          // parent_id: objectInfo.columnId,
          // parent_name: objectInfo.columnTitle,
          id,
          name,
          source: 'mg',
        })),
      })),
      source: 'mg',
    };
  },
  getTags() {
    return this.getTag();
  },

  getDetailPageUrl(id) {
    if (/playlist\/index\.html\?/.test(id)) {
      id = id.replace(/.*(?:\?|&)id=(\d+)(?:&.*|$)/, '$1');
    } else if (this.regExps.listDetailLink.test(id)) {
      id = id.replace(this.regExps.listDetailLink, '$1');
    }
    return `https://music.migu.cn/v3/music/playlist/${id}`;
  },

  filterSongListResult(raw) {
    const list = [];
    raw.forEach(item => {
      if (!item.id) return;

      const playCount = parseInt(item.playNum);
      list.push({
        play_count: isNaN(playCount) ? 0 : formatPlayCount(playCount),
        id: item.id,
        author: item.userName,
        name: item.name,
        img: item.musicListPicUrl,
        total: item.musicNum,
        source: 'mg',
      });
    });
    return list;
  },
  search(text, page, limit = 20) {
    const timeStr = Date.now().toString();
    const signResult = mgSignature(timeStr, text);
    return createHttpFetch(`https://jadeite.migu.cn/music_search/v3/search/searchAll?isCorrect=1&isCopyright=1&searchSwitch=%7B%22song%22%3A0%2C%22album%22%3A0%2C%22singer%22%3A0%2C%22tagSong%22%3A0%2C%22mvSong%22%3A0%2C%22bestShow%22%3A0%2C%22songlist%22%3A1%2C%22lyricSong%22%3A0%7D&pageSize=${limit}&text=${encodeURIComponent(text)}&pageNo=${page}&sort=0&sid=USS`, {
      headers: {
        uiVersion: 'A_music_3.6.1',
        deviceId: signResult.deviceId,
        timestamp: timeStr,
        sign: signResult.sign,
        channel: '0146921',
        'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
      },
    }).then(body => {
      if (!body.songListResultData) throw new Error('get song list faild.');

      const list = this.filterSongListResult(body.songListResultData.result);
      return {
        list,
        limit,
        total: parseInt(body.songListResultData.totalCount),
        source: 'mg',
      };
    });
  },
};

// ==================== kg 歌单（src/renderer/utils/musicSdk/kg/songList.js 移植） ====================
// kg/vendors/infSign.min.js 的 H5 签名由上方 infSignH5 提供
const handleSignature = (id, page, limit) => new Promise((resolve, reject) => {
  const result = infSignH5({ appid: 1058, type: 0, module: 'playlist', page, pagesize: limit, specialid: id }, {
    useH5: true,
    isCDN: true,
  });
  resolve(result.signature);
});

const kgSongList = {
  _requestObj_tags: null,
  _requestObj_listInfo: null,
  _requestObj_list: null,
  _requestObj_listRecommend: null,
  listDetailLimit: 10000,
  currentTagInfo: {
    id: undefined,
    info: undefined,
  },
  sortList: [
    {
      name: '推荐',
      id: '5',
    },
    {
      name: '最热',
      id: '6',
    },
    {
      name: '最新',
      id: '7',
    },
    {
      name: '热藏',
      id: '3',
    },
    {
      name: '飙升',
      id: '8',
    },
  ],
  cache: new Map(),
  regExps: {
    listData: /global\.data = (\[.+\]);/,
    listInfo: /global = {[\s\S]+?name: "(.+)"[\s\S]+?pic: "(.+)"[\s\S]+?};/,
    // https://www.kugou.com/yy/special/single/1067062.html
    listDetailLink: /^.+\/(\d+)\.html(?:\?.*|&.*$|#.*$|$)/,
  },
  parseHtmlDesc(html) {
    const prefix = '<div class="pc_specail_text pc_singer_tab_content" id="specailIntroduceWrap">';
    let index = html.indexOf(prefix);
    if (index < 0) return null;
    const afterStr = html.substring(index + prefix.length);
    index = afterStr.indexOf('</div>');
    if (index < 0) return null;
    return decodeName(afterStr.substring(0, index));
  },
  async getListDetailBySpecialId(id, page, tryNum = 0) {
    if (tryNum > 2) throw new Error('try max num');

    const { body } = await httpFetch(this.getSongListDetailUrl(id)).promise;
    const listData = body.match(this.regExps.listData);
    const listInfo = body.match(this.regExps.listInfo);
    if (!listData) return this.getListDetailBySpecialId(id, page, ++tryNum);
    const list = await this.getMusicInfos(JSON.parse(listData[1]));
    // listData = this.filterData(JSON.parse(listData[1]))
    let name;
    let pic;
    if (listInfo) {
      name = listInfo[1];
      pic = listInfo[2];
    }
    const desc = this.parseHtmlDesc(body);

    return {
      list,
      page: 1,
      limit: 10000,
      total: list.length,
      source: 'kg',
      info: {
        name,
        img: pic,
        desc,
        // author: body.result.info.userinfo.username,
        // play_count: formatPlayCount(body.result.listen_num),
      },
    };
  },
  getInfoUrl(tagId) {
    return tagId
      ? `http://www2.kugou.kugou.com/yueku/v9/special/getSpecial?is_smarty=1&cdn=cdn&t=5&c=${tagId}`
      : 'http://www2.kugou.kugou.com/yueku/v9/special/getSpecial?is_smarty=1&';
  },
  getSongListUrl(sortId, tagId, page) {
    if (tagId == null) tagId = '';
    return `http://www2.kugou.kugou.com/yueku/v9/special/getSpecial?is_ajax=1&cdn=cdn&t=${sortId}&c=${tagId}&p=${page}`;
  },
  getSongListDetailUrl(id) {
    return `http://www2.kugou.kugou.com/yueku/v9/special/single/${id}-5-9999.html`;
  },

  filterInfoHotTag(rawData) {
    const result = [];
    if (rawData.status !== 1) return result;
    for (const key of Object.keys(rawData.data)) {
      const tag = rawData.data[key];
      result.push({
        id: tag.special_id,
        name: tag.special_name,
        source: 'kg',
      });
    }
    return result;
  },
  filterTagInfo(rawData) {
    const result = [];
    for (const name of Object.keys(rawData)) {
      result.push({
        name,
        list: rawData[name].data.map(tag => ({
          parent_id: tag.parent_id,
          parent_name: tag.pname,
          id: tag.id,
          name: tag.name,
          source: 'kg',
        })),
      });
    }
    return result;
  },

  getSongList(sortId, tagId, page, tryNum = 0) {
    if (this._requestObj_list) this._requestObj_list.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_list = httpFetch(
      this.getSongListUrl(sortId, tagId, page),
    );
    return this._requestObj_list.promise.then(({ body }) => {
      if (!body || body.status !== 1) return this.getSongList(sortId, tagId, page, ++tryNum);
      return this.filterList(body.special_db);
    });
  },
  getSongListRecommend(tryNum = 0) {
    if (this._requestObj_listRecommend) this._requestObj_listRecommend.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_listRecommend = httpFetch(
      'http://everydayrec.service.kugou.com/guess_special_recommend',
      {
        method: 'post',
        headers: {
          'User-Agent': 'KuGou2012-8275-web_browser_event_handler',
        },
        body: {
          appid: 1001,
          clienttime: 1566798337219,
          clientver: 8275,
          key: 'f1f93580115bb106680d2375f8032d96',
          mid: '21511157a05844bd085308bc76ef3343',
          platform: 'pc',
          userid: '262643156',
          return_min: 6,
          return_max: 15,
        },
      },
    );
    return this._requestObj_listRecommend.promise.then(({ body }) => {
      if (body.status !== 1) return this.getSongListRecommend(++tryNum);
      return this.filterList(body.data.special_list);
    });
  },
  filterList(rawData) {
    return rawData.map(item => ({
      play_count: item.total_play_count || formatPlayCount(item.play_count),
      id: 'id_' + item.specialid,
      author: item.nickname,
      name: item.specialname,
      time: dateFormat(item.publish_time || item.publishtime, 'Y-M-D'),
      img: item.img || item.imgurl,
      total: item.songcount,
      grade: item.grade,
      desc: item.intro,
      source: 'kg',
    }));
  },

  async createHttp(url, options, retryNum = 0) {
    if (retryNum > 2) throw new Error('try max num');
    let result;
    try {
      result = await httpFetch(url, options).promise;
    } catch (err) {
      console.log(err);
      return this.createHttp(url, options, ++retryNum);
    }
    // console.log(result.statusCode, result.body)
    if (result.statusCode !== 200 ||
      (
        (result.body.error_code !== undefined
          ? result.body.error_code
          : result.body.errcode !== undefined
            ? result.body.errcode
            : result.body.err_code
        ) !== 0)
    ) return this.createHttp(url, options, ++retryNum);
    if (result.body.data) return result.body.data;
    if (Array.isArray(result.body.info)) return result.body;
    return result.body.info;
  },

  createTask(hashs) {
    const data = {
      area_code: '1',
      show_privilege: 1,
      show_album_info: '1',
      is_publish: '',
      appid: 1005,
      clientver: 11451,
      mid: '1',
      dfid: '-',
      clienttime: Date.now(),
      key: 'OIlwieks28dk2k092lksi2UIkp',
      fields: 'album_info,author_name,audio_info,ori_audio_name,base,songname',
    };
    let list = hashs;
    const tasks = [];
    while (list.length) {
      tasks.push(Object.assign({ data: list.slice(0, 100) }, data));
      if (list.length < 100) break;
      list = list.slice(100);
    }
    const url = 'http://gateway.kugou.com/v2/album_audio/audio';
    return tasks.map(task => this.createHttp(url, {
      method: 'POST',
      body: task,
      headers: {
        'KG-THash': '13a3164',
        'KG-RC': '1',
        'KG-Fake': '0',
        'KG-RF': '00869891',
        'User-Agent': 'Android712-AndroidPhone-11451-376-0-FeeCacheUpdate-wifi',
        'x-router': 'kmr.service.kugou.com',
      },
    }).then(data => data.map(s => s[0])));
  },
  async getMusicInfos(list) {
    return this.filterData2(
      await Promise.all(
        this.createTask(
          this.deDuplication(list)
            .map(item => ({ hash: item.hash })),
        ))
        .then(([...datas]) => datas.flat()));
  },

  async getUserListDetailByCode(id) {
    const songInfo = await this.createHttp('http://t.kugou.com/command/', {
      method: 'POST',
      headers: {
        'KG-RC': 1,
        'KG-THash': 'network_super_call.cpp:3676261689:379',
        'User-Agent': '',
      },
      body: { appid: 1001, clientver: 9020, mid: '21511157a05844bd085308bc76ef3343', clienttime: 640612895, key: '36164c4015e704673c588ee202b9ecb8', data: id },
    });
    // console.log(songInfo)
    // type 1单曲，2歌单，3电台，4酷狗码，5别人的播放队列
    let songList;
    const info = songInfo.info;
    switch (info.type) {
      case 2:
        if (!info.global_collection_id) return this.getListDetailBySpecialId(info.id);
        break;

      default:
        break;
    }
    if (info.global_collection_id) return this.getUserListDetail2(info.global_collection_id);
    if (info.userid != null) {
      songList = await this.createHttp('http://www2.kugou.kugou.com/apps/kucodeAndShare/app/', {
        method: 'POST',
        headers: {
          'KG-RC': 1,
          'KG-THash': 'network_super_call.cpp:3676261689:379',
          'User-Agent': '',
        },
        body: { appid: 1001, clientver: 9020, mid: '21511157a05844bd085308bc76ef3343', clienttime: 640612895, key: '36164c4015e704673c588ee202b9ecb8', data: { id: info.id, type: 3, userid: info.userid, collect_type: 0, page: 1, pagesize: info.count } },
      });
      // console.log(songList)
    }
    const list = await this.getMusicInfos(songList || songInfo.list);
    return {
      list,
      page: 1,
      limit: info.count,
      total: list.length,
      source: 'kg',
      info: {
        name: info.name,
        img: (info.img_size && info.img_size.replace('{size}', 240)) || info.img,
        // desc: body.result.info.list_desc,
        author: info.username,
        // play_count: formatPlayCount(info.count),
      },
    };
  },

  async getUserListDetail3(chain, page) {
    const songInfo = await this.createHttp(`http://m.kugou.com/schain/transfer?pagesize=${this.listDetailLimit}&chain=${chain}&su=1&page=${page}&n=0.7928855356604456`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
      },
    });
    if (!songInfo.list) {
      if (songInfo.global_collection_id) return this.getUserListDetail2(songInfo.global_collection_id);
      else return this.getUserListDetail4(songInfo, chain, page).catch(() => this.getUserListDetail5(chain));
    }
    const list = await this.getMusicInfos(songInfo.list);
    // console.log(info, songInfo)
    return {
      list,
      page: 1,
      limit: this.listDetailLimit,
      total: list.length,
      source: 'kg',
      info: {
        name: songInfo.info.name,
        img: songInfo.info.img,
        // desc: body.result.info.list_desc,
        author: songInfo.info.username,
        // play_count: formatPlayCount(info.count),
      },
    };
  },

  deDuplication(datas) {
    const ids = new Set();
    return datas.filter(({ hash }) => {
      if (ids.has(hash)) return false;
      ids.add(hash);
      return true;
    });
  },

  async decodeGcid(gcid) {
    const params = 'dfid=-&appid=1005&mid=0&clientver=20109&clienttime=640612895&uuid=-';
    const body = {
      ret_info: 1,
      data: [
        {
          id: gcid,
          id_type: 2,
        },
      ],
    };
    const result = await this.createHttp(`https://t.kugou.com/v1/songlist/batch_decode?${params}&signature=${signatureParams(params, 'android', JSON.stringify(body))}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; HUAWEI HMA-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36',
        Referer: 'https://m.kugou.com/',
      },
      body,
    });
    return result.list[0].global_collection_id;
  },

  async getUserListDetailByLink({ info }, link) {
    const listInfo = info['0'];
    let total = listInfo.count;
    const tasks = [];
    let page = 0;
    while (total) {
      const limit = total > 90 ? 90 : total;
      total -= limit;
      page += 1;
      tasks.push(this.createHttp(link.replace(/pagesize=\d+/, 'pagesize=' + limit).replace(/page=\d+/, 'page=' + page), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
          Referer: link,
        },
      }).then(data => data.list.info));
    }
    let result = await Promise.all(tasks).then(([...datas]) => datas.flat());
    result = await this.getMusicInfos(result);
    // console.log(result)
    return {
      list: result,
      page,
      limit: this.listDetailLimit,
      total: result.length,
      source: 'kg',
      info: {
        name: listInfo.name,
        img: listInfo.pic && listInfo.pic.replace('{size}', 240),
        // desc: body.result.info.list_desc,
        author: listInfo.list_create_username,
        // play_count: formatPlayCount(listInfo.count),
      },
    };
  },
  createGetListDetail2Task(id, total) {
    const tasks = [];
    let page = 0;
    while (total) {
      const limit = total > 300 ? 300 : total;
      total -= limit;
      page += 1;
      const params = 'appid=1058&global_specialid=' + id + '&specialid=0&plat=0&version=8000&page=' + page + '&pagesize=' + limit + '&srcappid=2919&clientver=20000&clienttime=1586163263991&mid=1586163263991&uuid=1586163263991&dfid=-';
      tasks.push(this.createHttp(`https://mobiles.kugou.com/api/v5/special/song_v2?${params}&signature=${signatureParams(params, 'web')}`, {
        headers: {
          mid: '1586163263991',
          Referer: 'https://m3ws.kugou.com/share/index.php',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
          dfid: '-',
          clienttime: '1586163263991',
        },
      }).then(data => data.info));
    }
    return Promise.all(tasks).then(([...datas]) => datas.flat());
  },
  async getUserListDetail2(global_collection_id) {
    const id = global_collection_id;
    if (id.length > 1000) throw new Error('get list error');
    const params = 'appid=1058&specialid=0&global_specialid=' + id + '&format=jsonp&srcappid=2919&clientver=20000&clienttime=1586163242519&mid=1586163242519&uuid=1586163242519&dfid=-';
    const info = await this.createHttp(`https://mobiles.kugou.com/api/v5/special/info_v2?${params}&signature=${signatureParams(params, 'web')}`, {
      headers: {
        mid: '1586163242519',
        Referer: 'https://m3ws.kugou.com/share/index.php',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        dfid: '-',
        clienttime: '1586163242519',
      },
    });
    const songInfo = await this.createGetListDetail2Task(id, info.songcount);
    const list = await this.getMusicInfos(songInfo);
    // console.log(info, songInfo, list)
    return {
      list,
      page: 1,
      limit: this.listDetailLimit,
      total: list.length,
      source: 'kg',
      info: {
        name: info.specialname,
        img: info.imgurl && info.imgurl.replace('{size}', 240),
        desc: info.intro,
        author: info.nickname,
        play_count: formatPlayCount(info.playcount),
      },
    };
  },

  async getListInfoByChain(chain) {
    if (this.cache.has(chain)) return this.cache.get(chain);
    const { body } = await httpFetch(`https://m.kugou.com/share/?chain=${chain}&id=${chain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
      },
    }).promise;
    let result = body.match(/var\sphpParam\s=\s({.+?});/);
    if (result) result = JSON.parse(result[1]);
    this.cache.set(chain, result);
    return result;
  },

  async getUserListDetailByPcChain(chain) {
    const key = `${chain}_pc_list`;
    if (this.cache.has(key)) return this.cache.get(key);
    const { body } = await httpFetch(`http://www.kugou.com/share/${chain}.html`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
      },
    }).promise;
    let result = body.match(/var\sdataFromSmarty\s=\s(\[.+?\])/);
    if (result) result = JSON.parse(result[1]);
    this.cache.set(key, result);
    result = await this.getMusicInfos(result);
    // console.log(info, songInfo)
    return result;
  },

  async getUserListDetail4(songInfo, chain, page) {
    const limit = 100;
    const [listInfo, list] = await Promise.all([
      this.getListInfoByChain(chain),
      this.getUserListDetailById(songInfo.id, page, limit),
    ]);
    return {
      list: list || [],
      page,
      limit,
      total: list.length ?? 0,
      source: 'kg',
      info: {
        name: listInfo.specialname,
        img: listInfo.imgurl && listInfo.imgurl.replace('{size}', 240),
        // desc: body.result.info.list_desc,
        author: listInfo.nickname,
        // play_count: formatPlayCount(info.count),
      },
    };
  },

  async getUserListDetail5(chain) {
    const [listInfo, list] = await Promise.all([
      this.getListInfoByChain(chain),
      this.getUserListDetailByPcChain(chain),
    ]);
    return {
      list: list || [],
      page: 1,
      limit: this.listDetailLimit,
      total: list.length ?? 0,
      source: 'kg',
      info: {
        name: listInfo.specialname,
        img: listInfo.imgurl && listInfo.imgurl.replace('{size}', 240),
        // desc: body.result.info.list_desc,
        author: listInfo.nickname,
        // play_count: formatPlayCount(info.count),
      },
    };
  },

  async getUserListDetailById(id, page, limit) {
    const signature = await handleSignature(id, page, limit);
    const info = await this.createHttp(`https://pubsongscdn.kugou.com/v2/get_other_list_file?srcappid=2919&clientver=20000&appid=1058&type=0&module=playlist&page=${page}&pagesize=${limit}&specialid=${id}&signature=${signature}`, {
      headers: {
        Referer: 'https://m3ws.kugou.com/share/index.php',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        dfid: '-',
      },
    });

    // console.log(info)
    const result = await this.getMusicInfos(info.info);
    // console.log(info, songInfo)
    return result;
  },

  async getUserListDetail(link, page, retryNum = 0) {
    if (retryNum > 3) return Promise.reject(new Error('link try max num'));
    if (link.includes('#')) link = link.replace(/#.*$/, '');
    if (link.includes('global_collection_id')) return this.getUserListDetail2(link.replace(/^.*?global_collection_id=(\w+)(?:&.*$|#.*$|$)/, '$1'));
    if (link.includes('gcid_')) {
      const gcid = link.match(/gcid_\w+/)?.[0];
      if (gcid) {
        const global_collection_id = await this.decodeGcid(gcid);
        if (global_collection_id) return this.getUserListDetail2(global_collection_id);
      }
    }
    if (link.includes('chain=')) return this.getUserListDetail3(link.replace(/^.*?chain=(\w+)(?:&.*$|#.*$|$)/, '$1'), page);
    if (link.includes('.html')) {
      if (link.includes('zlist.html')) {
        link = link.replace(/^(.*)zlist\.html/, 'https://m3ws.kugou.com/zlist/list');
        if (link.includes('pagesize')) {
          link = link.replace('pagesize=30', 'pagesize=' + this.listDetailLimit).replace('page=1', 'page=' + page);
        } else {
          link += `&pagesize=${this.listDetailLimit}&page=${page}`;
        }
      } else if (!link.includes('song.html')) return this.getUserListDetail3(link.replace(/.+\/(\w+).html(?:\?.*|&.*$|#.*$|$)/, '$1'), page);
    }

    const requestObj_listDetailLink = httpFetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
        Referer: link,
      },
    });
    const { headers: { location }, statusCode, body } = await requestObj_listDetailLink.promise;
    // console.log(body, location)
    if (statusCode > 400) return this.getUserListDetail(link, page, ++retryNum);
    if (location) {
      // console.log(location)
      if (location.includes('global_collection_id')) return this.getUserListDetail2(location.replace(/^.*?global_collection_id=(\w+)(?:&.*$|#.*$|$)/, '$1'));
      if (location.includes('gcid_')) {
        const gcid = link.match(/gcid_\w+/)?.[0];
        if (gcid) {
          const global_collection_id = await this.decodeGcid(gcid);
          if (global_collection_id) return this.getUserListDetail2(global_collection_id);
        }
      }
      if (location.includes('chain=')) return this.getUserListDetail3(location.replace(/^.*?chain=(\w+)(?:&.*$|#.*$|$)/, '$1'), page);
      if (location.includes('.html')) {
        if (location.includes('zlist.html')) {
          let link = location.replace(/^(.*)zlist\.html/, 'https://m3ws.kugou.com/zlist/list');
          if (link.includes('pagesize')) {
            link = link.replace('pagesize=30', 'pagesize=' + this.listDetailLimit).replace('page=1', 'page=' + page);
          } else {
            link += `&pagesize=${this.listDetailLimit}&page=${page}`;
          }
          return this.getUserListDetail(link, page, ++retryNum);
        } else return this.getUserListDetail3(location.replace(/.+\/(\w+).html(?:\?.*|&.*$|#.*$|$)/, '$1'), page);
      }
      // console.log('location', location)
      return this.getUserListDetail(location, page, ++retryNum);
    }
    if (typeof body == 'string') {
      let global_collection_id = body.match(/"global_collection_id":"(\w+)"/)?.[1];
      if (!global_collection_id) {
        let gcid = body.match(/"encode_gic":"(\w+)"/)?.[1];
        if (!gcid) gcid = body.match(/"encode_src_gid":"(\w+)"/)?.[1];
        if (gcid) global_collection_id = await this.decodeGcid(gcid);
      }
      if (!global_collection_id) throw new Error('get list error');
      return this.getUserListDetail2(global_collection_id);
    }
    if (body.errcode !== 0) return this.getUserListDetail(link, page, ++retryNum);
    return this.getUserListDetailByLink(body, link);
  },

  async getListDetail(id, page) { // 获取歌曲列表内的音乐
    id = id.toString();
    if (id.includes('special/single/')) {
      id = id.replace(this.regExps.listDetailLink, '$1');
    } else if (/https?:/.test(id)) {
      // fix https://www.kugou.com/songlist/xxx/?uid=xxx&chl=qq_client&cover=http%3A%2F%2Fimge.kugou.com%xxx.jpg&iszlist=1
      return this.getUserListDetail(id.replace(/^.*?http/, 'http'), page);
    } else if (/^\d+$/.test(id)) {
      return this.getUserListDetailByCode(id);
    } else if (id.startsWith('id_')) {
      id = id.replace('id_', '');
    }

    return this.getListDetailBySpecialId(id, page);
  },

  // hash list filter
  filterData2(rawList) {
    // console.log(rawList)
    const ids = new Set();
    const list = [];
    rawList.forEach(item => {
      if (!item) return;
      if (ids.has(item.audio_info.audio_id)) return;
      ids.add(item.audio_info.audio_id);
      const types = [];
      const _types = {};
      if (item.audio_info.filesize !== '0') {
        const size = sizeFormate(parseInt(item.audio_info.filesize));
        types.push({ type: '128k', size, hash: item.audio_info.hash });
        _types['128k'] = {
          size,
          hash: item.audio_info.hash,
        };
      }
      if (item.audio_info.filesize_320 !== '0') {
        const size = sizeFormate(parseInt(item.audio_info.filesize_320));
        types.push({ type: '320k', size, hash: item.audio_info.hash_320 });
        _types['320k'] = {
          size,
          hash: item.audio_info.hash_320,
        };
      }
      if (item.audio_info.filesize_flac !== '0') {
        const size = sizeFormate(parseInt(item.audio_info.filesize_flac));
        types.push({ type: 'flac', size, hash: item.audio_info.hash_flac });
        _types.flac = {
          size,
          hash: item.audio_info.hash_flac,
        };
      }
      if (item.audio_info.filesize_high !== '0') {
        const size = sizeFormate(parseInt(item.audio_info.filesize_high));
        types.push({ type: 'flac24bit', size, hash: item.audio_info.hash_high });
        _types.flac24bit = {
          size,
          hash: item.audio_info.hash_high,
        };
      }
      list.push({
        singer: decodeName(item.author_name),
        name: decodeName(item.songname),
        albumName: decodeName(item.album_info.album_name),
        albumId: item.album_info.album_id,
        songmid: item.audio_info.audio_id,
        source: 'kg',
        interval: formatPlayTime(parseInt(item.audio_info.timelength) / 1000),
        img: null,
        lrc: null,
        hash: item.audio_info.hash,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      });
    });
    return list;
  },

  // 获取列表信息
  getListInfo(tagId, tryNum = 0) {
    if (this._requestObj_listInfo) this._requestObj_listInfo.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_listInfo = httpFetch(this.getInfoUrl(tagId));
    return this._requestObj_listInfo.promise.then(({ body }) => {
      if (body.status !== 1) return this.getListInfo(tagId, ++tryNum);
      return {
        limit: body.data.params.pagesize,
        page: body.data.params.p,
        total: body.data.params.total,
        source: 'kg',
      };
    });
  },

  // 获取列表数据
  getList(sortId, tagId, page) {
    const tasks = [this.getSongList(sortId, tagId, page)];
    tasks.push(
      this.currentTagInfo.id === tagId
        ? Promise.resolve(this.currentTagInfo.info)
        : this.getListInfo(tagId).then(info => {
          this.currentTagInfo.id = tagId;
          this.currentTagInfo.info = Object.assign({}, info);
          return info;
        }),
    );
    if (!tagId && page === 1 && sortId === this.sortList[0].id) tasks.push(this.getSongListRecommend()); // 如果是所有类别，则顺便获取推荐列表
    return Promise.all(tasks).then(([list, info, recommendList]) => {
      if (recommendList) list.unshift(...recommendList);
      return {
        list,
        ...info,
      };
    });
  },

  // 获取标签
  getTags(tryNum = 0) {
    if (this._requestObj_tags) this._requestObj_tags.cancelHttp();
    if (tryNum > 2) return Promise.reject(new Error('try max num'));
    this._requestObj_tags = httpFetch(this.getInfoUrl());
    return this._requestObj_tags.promise.then(({ body }) => {
      if (body.status !== 1) return this.getTags(++tryNum);
      return {
        hotTag: this.filterInfoHotTag(body.data.hotTag),
        tags: this.filterTagInfo(body.data.tagids),
        source: 'kg',
      };
    });
  },

  getDetailPageUrl(id) {
    if (typeof id == 'string') {
      if (/^https?:\/\//.test(id)) return id;
      id = id.replace('id_', '');
    }
    return `https://www.kugou.com/yy/special/single/${id}.html`;
  },

  search(text, page, limit = 20) {
    return httpFetch(`http://msearchretry.kugou.com/api/v3/search/special?keyword=${encodeURIComponent(text)}&page=${page}&pagesize=${limit}&showtype=10&filter=0&version=7910&sver=2`)
      .promise.then(({ body }) => {
        if (body.errcode != 0) throw new Error('filed');
        // console.log(body.data.info)
        return {
          list: body.data.info.map(item => {
            return {
              play_count: formatPlayCount(item.playcount),
              id: 'id_' + item.specialid,
              author: item.nickname,
              name: item.specialname,
              time: dateFormat(item.publishtime, 'Y-M-D'),
              img: item.imgurl,
              grade: item.grade,
              desc: item.intro,
              total: item.songcount,
              source: 'kg',
            };
          }),
          limit,
          total: body.data.total,
          source: 'kg',
        };
      });
  },
};

// ==================== kw 排行榜（src/renderer/utils/musicSdk/kw/leaderboard.js 移植） ====================
const kwBoardList = [
  { id: 'kw__93', name: '飙升榜', bangid: '93' },
  { id: 'kw__17', name: '新歌榜', bangid: '17' },
  { id: 'kw__16', name: '热歌榜', bangid: '16' },
  { id: 'kw__158', name: '抖音热歌榜', bangid: '158' },
  { id: 'kw__292', name: '铃声榜', bangid: '292' },
  { id: 'kw__284', name: '热评榜', bangid: '284' },
  { id: 'kw__290', name: 'ACG新歌榜', bangid: '290' },
  { id: 'kw__286', name: '台湾KKBOX榜', bangid: '286' },
  { id: 'kw__279', name: '冬日暖心榜', bangid: '279' },
  { id: 'kw__281', name: '巴士随身听榜', bangid: '281' },
  { id: 'kw__255', name: 'KTV点唱榜', bangid: '255' },
  { id: 'kw__280', name: '家务进行曲榜', bangid: '280' },
  { id: 'kw__282', name: '熬夜修仙榜', bangid: '282' },
  { id: 'kw__283', name: '枕边轻音乐榜', bangid: '283' },
  { id: 'kw__278', name: '古风音乐榜', bangid: '278' },
  { id: 'kw__264', name: 'Vlog音乐榜', bangid: '264' },
  { id: 'kw__242', name: '电音榜', bangid: '242' },
  { id: 'kw__187', name: '流行趋势榜', bangid: '187' },
  { id: 'kw__204', name: '现场音乐榜', bangid: '204' },
  { id: 'kw__186', name: 'ACG神曲榜', bangid: '186' },
  { id: 'kw__185', name: '最强翻唱榜', bangid: '185' },
  { id: 'kw__26', name: '经典怀旧榜', bangid: '26' },
  { id: 'kw__104', name: '华语榜', bangid: '104' },
  { id: 'kw__182', name: '粤语榜', bangid: '182' },
  { id: 'kw__22', name: '欧美榜', bangid: '22' },
  { id: 'kw__184', name: '韩语榜', bangid: '184' },
  { id: 'kw__183', name: '日语榜', bangid: '183' },
  { id: 'kw__145', name: '会员畅听榜', bangid: '145' },
  { id: 'kw__153', name: '网红新歌榜', bangid: '153' },
  { id: 'kw__64', name: '影视金曲榜', bangid: '64' },
  { id: 'kw__176', name: 'DJ嗨歌榜', bangid: '176' },
  { id: 'kw__106', name: '真声音', bangid: '106' },
  { id: 'kw__12', name: 'Billboard榜', bangid: '12' },
  { id: 'kw__49', name: 'iTunes音乐榜', bangid: '49' },
  { id: 'kw__180', name: 'beatport电音榜', bangid: '180' },
  { id: 'kw__13', name: '英国UK榜', bangid: '13' },
  { id: 'kw__164', name: '百大DJ榜', bangid: '164' },
  { id: 'kw__246', name: 'YouTube音乐排行榜', bangid: '246' },
  { id: 'kw__265', name: '韩国Genie榜', bangid: '265' },
  { id: 'kw__14', name: '韩国M-net榜', bangid: '14' },
  { id: 'kw__8', name: '香港电台榜', bangid: '8' },
  { id: 'kw__15', name: '日本公信榜', bangid: '15' },
  { id: 'kw__151', name: '腾讯音乐人原创榜', bangid: '151' },
];

const sortQualityArray = array => {
  const qualityMap = {
    flac24bit: 4,
    flac: 3,
    '320k': 2,
    '128k': 1,
  };
  const rawQualityArray = [];
  const newQualityArray = [];

  array.forEach((item, index) => {
    const type = qualityMap[item.type];
    if (!type) return;
    rawQualityArray.push({ type, index });
  });

  rawQualityArray.sort((a, b) => a.type - b.type);

  rawQualityArray.forEach(item => {
    newQualityArray.push(array[item.index]);
  });

  return newQualityArray;
};

const kwLeaderboard = {
  list: [
    { id: 'kwbiaosb', name: '飙升榜', bangid: 93 },
    { id: 'kwregb', name: '热歌榜', bangid: 16 },
    { id: 'kwhuiyb', name: '会员榜', bangid: 145 },
    { id: 'kwdouyb', name: '抖音榜', bangid: 158 },
    { id: 'kwqsb', name: '趋势榜', bangid: 187 },
    { id: 'kwhuaijb', name: '怀旧榜', bangid: 26 },
    { id: 'kwhuayb', name: '华语榜', bangid: 104 },
    { id: 'kwyueyb', name: '粤语榜', bangid: 182 },
    { id: 'kwoumb', name: '欧美榜', bangid: 22 },
    { id: 'kwhanyb', name: '韩语榜', bangid: 184 },
    { id: 'kwriyb', name: '日语榜', bangid: 183 },
  ],
  regExps: {
    mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/,
  },
  limit: 100,
  _requestBoardsObj: null,

  getBoardsData() {
    if (this._requestBoardsObj) this._requestBoardsObj.cancelHttp();
    this._requestBoardsObj = httpFetch('http://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2');
    return this._requestBoardsObj.promise;
  },
  getData(url) {
    const requestDataObj = httpFetch(url);
    return requestDataObj.promise;
  },
  filterData(rawList) {
    return rawList.map(item => {
      let types = [];
      const _types = {};
      const qualitys = new Set();

      item.n_minfo.split(';').forEach(i => {
        const info = i.match(this.regExps.mInfo);
        if (!info) return;

        const quality = info[2];
        const size = info[4].toLocaleUpperCase();

        if (qualitys.has(quality)) return;
        qualitys.add(quality);

        switch (quality) {
          case '4000':
            types.push({ type: 'flac24bit', size });
            _types.flac24bit = { size };
            break;
          case '2000':
            types.push({ type: 'flac', size });
            _types.flac = { size };
            break;
          case '320':
            types.push({ type: '320k', size });
            _types['320k'] = { size };
            break;
          case '128':
            types.push({ type: '128k', size });
            _types['128k'] = { size };
            break;
        }
      });
      types = sortQualityArray(types);

      return {
        singer: formatSinger(decodeName(item.artist)),
        name: decodeName(item.name),
        albumName: decodeName(item.album),
        albumId: item.albumId,
        songmid: item.id,
        source: 'kw',
        interval: formatPlayTime(parseInt(item.duration)),
        img: item.pic,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      };
    });
  },
  filterBoardsData(rawList) {
    // console.log(rawList)
    const list = [];
    for (const board of rawList) {
      if (board.source != '1') continue;
      list.push({
        id: 'kw__' + board.sourceid,
        name: board.name,
        bangid: String(board.sourceid),
      });
    }
    return list;
  },
  async getBoards(retryNum = 0) {
    // 动态获取榜单接口已失效，固定返回内置榜单（同官方客户端行为）
    this.list = kwBoardList;
    return {
      list: kwBoardList,
      source: 'kw',
    };
  },

  getList(id, page, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'));

    const requestBody = { uid: '', devId: '', sFrom: 'kuwo_sdk', user_type: 'AP', carSource: 'kwplayercar_ar_6.0.1.0_apk_keluze.apk', id, pn: page - 1, rn: this.limit };
    const requestUrl = `https://wbd.kuwo.cn/api/bd/bang/bang_info?${wbdCrypto.buildParam(requestBody)}`;
    const request = httpFetch(requestUrl).promise;

    return request.then(({ statusCode, body }) => {
      const rawData = wbdCrypto.decodeData(body);
      // console.log(rawData)
      const data = rawData.data;
      if (statusCode !== 200 || rawData.code != 200 || !data.musiclist) return this.getList(id, page, retryNum);

      const total = parseInt(data.total);
      const list = this.filterData(data.musiclist);

      return {
        total,
        list,
        limit: this.limit,
        page,
        source: 'kw',
      };
    });
  },
};

// ==================== mg 排行榜（src/renderer/utils/musicSdk/mg/leaderboard.js 移植） ====================
const mgBoardList = [
  { id: 'mg__27553319', name: '新歌榜', bangid: '27553319', source: 'mg' },
  { id: 'mg__27186466', name: '热歌榜', bangid: '27186466', source: 'mg' },
  { id: 'mg__27553408', name: '原创榜', bangid: '27553408', source: 'mg' },
  { id: 'mg__75959118', name: '音乐风向榜', bangid: '75959118', source: 'mg' },
  { id: 'mg__76557036', name: '彩铃分贝榜', bangid: '76557036', source: 'mg' },
  { id: 'mg__76557745', name: '会员臻爱榜', bangid: '76557745', source: 'mg' },
  { id: 'mg__23189800', name: '港台榜', bangid: '23189800', source: 'mg' },
  { id: 'mg__23189399', name: '内地榜', bangid: '23189399', source: 'mg' },
  { id: 'mg__19190036', name: '欧美榜', bangid: '19190036', source: 'mg' },
  { id: 'mg__83176390', name: '国风金曲榜', bangid: '83176390', source: 'mg' },
];

const mgLeaderboard = {
  limit: 200,
  list: [
    { id: 'mgyyb', name: '音乐榜', bangid: '27553319' },
    { id: 'mgysb', name: '影视榜', bangid: '23603721' },
    { id: 'mghybnd', name: '华语内地榜', bangid: '23603926' },
    { id: 'mghyjqbgt', name: '华语港台榜', bangid: '23603954' },
    { id: 'mgomb', name: '欧美榜', bangid: '23603974' },
    { id: 'mgrhb', name: '日韩榜', bangid: '23603982' },
    { id: 'mgwlb', name: '网络榜', bangid: '23604058' },
    { id: 'mgclb', name: '彩铃榜', bangid: '23604023' },
    { id: 'mgktvb', name: 'KTV榜', bangid: '23604040' },
    { id: 'mgrcb', name: '原创榜', bangid: '23604032' },
  ],
  getUrl(id, page) {
    return `https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querycontentbyId.do?columnId=${id}&needAll=0`;
  },
  successCode: '000000',
  requestBoardsObj: null,
  getBoardsData() {
    if (this.requestBoardsObj) this._requestBoardsObj.cancelHttp();
    this.requestBoardsObj = httpFetch('https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0', {
      headers: {
        Referer: 'https://app.c.nf.migu.cn/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36',
        channel: '0146921',
      },
    });
    return this.requestBoardsObj.promise;
  },
  getData(url) {
    const requestObj = httpFetch(url);
    return requestObj.promise;
  },
  async getBoards(retryNum = 0) {
    // 动态获取榜单接口已失效，固定返回内置榜单（同官方客户端行为）
    this.list = mgBoardList;
    return {
      list: mgBoardList,
      source: 'mg',
    };
  },
  getList(bangid, page, retryNum = 0) {
    if (++retryNum > 3) return Promise.reject(new Error('try max num'));
    return this.getData(this.getUrl(bangid, page)).then(({ statusCode, body }) => {
      // console.log(body)
      if (statusCode !== 200 || body.code !== this.successCode) return this.getList(bangid, page, retryNum);
      const list = filterMusicInfoList(body.columnInfo.contents.map(m => m.objectInfo));
      return {
        total: list.length,
        list,
        limit: this.limit,
        page,
        source: 'mg',
      };
    });
  },

  getDetailPageUrl(id) {
    if (typeof id == 'string') id = id.replace('mg__', '');
    for (const item of mgBoardList) {
      if (item.bangid == id) {
        return `https://music.migu.cn/v3/music/top/${item.webId}`;
      }
    }
    return null;
  },
};

// ---------------- 导出约定 ----------------
const normalizeBangId = (id, prefix) => String(id).startsWith(prefix) ? String(id).slice(prefix.length) : String(id);

module.exports = {
  PLATFORMS: {
    kw: {
      songList: {
        getLists: async (type, page, limit) => {
          const tagId = type === 'all' ? undefined : type;
          return kwSongList.getList('hot', tagId, page);
        },
        getList: async (id, page, limit) => {
          return kwSongList.getListDetail(id, page);
        },
      },
      leaderboard: {
        getLists: async () => kwLeaderboard.getBoards(),
        getList: async (id, page, limit) => {
          return kwLeaderboard.getList(normalizeBangId(id, 'kw__'), page);
        },
      },
    },
    kg: {
      songList: {
        getLists: async (type, page, limit) => {
          const tagId = type === 'all' ? undefined : type;
          return kgSongList.getList('5', tagId, page);
        },
        getList: async (id, page, limit) => {
          return kgSongList.getListDetail(id, page);
        },
      },
      leaderboard: {
        getLists: async () => kgLeaderboard.getBoards(),
        getList: async (id, page, limit) => {
          return kgLeaderboard.getList(normalizeBangId(id, 'kg__'), page);
        },
      },
    },
    mg: {
      songList: {
        getLists: async (type, page, limit) => {
          const tagId = type === 'all' ? undefined : type;
          return mgSongList.getList('15127315', tagId, page);
        },
        getList: async (id, page, limit) => {
          return mgSongList.getListDetail(id, page);
        },
      },
      leaderboard: {
        getLists: async () => mgLeaderboard.getBoards(),
        getList: async (id, page, limit) => {
          return mgLeaderboard.getList(normalizeBangId(id, 'mg__'), page);
        },
      },
    },
  },
};
