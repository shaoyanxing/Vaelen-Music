export const sizeFormate = size => {
  if (!size) return '0 B'
  let units = ['B', 'KB', 'MB', 'GB', 'TB']
  let number = Math.floor(Math.log(size) / Math.log(1024))
  return `${(size / Math.pow(1024, Math.floor(number))).toFixed(2)} ${units[number]}`
}

const numFix = n => n < 10 ? (`0${n}`) : n.toString()

export const formatPlayTime = time => {
  let m = Math.trunc(time / 60)
  let s = Math.trunc(time % 60)
  return m == 0 && s == 0 ? '--/--' : numFix(m) + ':' + numFix(s)
}

export const decodeName = (str = '') => {
  if (!str) return ''
  try {
    return new DOMParser().parseFromString(String(str), 'text/html').body.textContent
  } catch (_) {
    return String(str)
  }
}

export const formatSingerName = (singers, nameKey = 'name', join = '、') => {
  if (Array.isArray(singers)) {
    const singer = []
    singers.forEach(item => {
      let name = item[nameKey]
      if (!name) return
      singer.push(name)
    })
    return decodeName(singer.join(join))
  }
  return decodeName(String(singers ?? ''))
}

export const formatSinger = rawData => String(rawData).replace(/&/g, '、')