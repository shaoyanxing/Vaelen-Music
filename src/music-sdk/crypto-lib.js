import MD5 from 'crypto-js/md5'
import SHA1 from 'crypto-js/sha1'
import SHA256 from 'crypto-js/sha256'
import AES from 'crypto-js/aes'
import encHex from 'crypto-js/enc-hex'
import encUtf8 from 'crypto-js/enc-utf8'
import encLatin1 from 'crypto-js/enc-latin1'
import encBase64 from 'crypto-js/enc-base64'
import modeECB from 'crypto-js/mode-ecb'
import padPkcs7 from 'crypto-js/pad-pkcs7'
import core from 'crypto-js/core'
import 'crypto-js/cipher-core'

const C = core.default || core

export default {
  MD5,
  SHA1,
  SHA256,
  AES,
  enc: { Hex: encHex, Utf8: encUtf8, Latin1: encLatin1, Base64: encBase64 },
  mode: { ECB: modeECB, CBC: C.mode.CBC },
  pad: { Pkcs7: padPkcs7 },
}