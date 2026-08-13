import CJS from './crypto-lib.js'

const eapiKey = 'e82ckenh8dichen8'

export const toMD5 = str => CJS.MD5(String(str)).toString(CJS.enc.Hex)

export const sha1Hex = str => CJS.SHA1(String(str)).toString(CJS.enc.Hex)

const aes128EcbHex = (data, key) => CJS.AES.encrypt(
  CJS.enc.Utf8.parse(String(data)),
  CJS.enc.Utf8.parse(String(key)),
  { mode: CJS.mode.ECB }
).ciphertext.toString(CJS.enc.Hex).toUpperCase()

export const eapi = (url, object) => {
  const text = typeof object === 'object' ? JSON.stringify(object) : String(object)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = toMD5(message)
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: aes128EcbHex(data, eapiKey),
  }
}

const PART_1_INDEXES = [23, 14, 6, 36, 16, 40, 7, 19]
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5]
const SCRAMBLE_VALUES = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179]

const bytesToBase64 = bytes => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export const zzcSign = text => {
  const hash = sha1Hex(text)
  const part1 = PART_1_INDEXES.map(idx => hash[idx]).join('')
  const part2 = PART_2_INDEXES.map(idx => hash[idx]).join('')
  const part3 = SCRAMBLE_VALUES.map((value, i) => value ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16))
  const b64Part = bytesToBase64(part3).replace(/[\\/+=]/g, '')
  return `zzc${part1}${b64Part}${part2}`.toLowerCase()
}

export const mgSignature = (time, str) => {
  const deviceId = '963B7AA0D21511ED807EE5846EC87D20'
  const signatureMd5 = '6cdc72a439cef99a3418d2a78aa28c73'
  const sign = toMD5(`${str}${signatureMd5}yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${time}`)
  return { sign, deviceId }
}
