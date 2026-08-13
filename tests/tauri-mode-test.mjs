import { readFile } from 'node:fs/promises'

globalThis.__TAURI_INTERNALS__ = {}

globalThis.invoke = async (cmd, args) => {
  const { options } = args
  const res = await fetch(options.url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.form
      ? new URLSearchParams(options.form).toString()
      : typeof options.body === 'string' ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  return {
    status_code: res.status,
    status_message: '',
    headers: Object.fromEntries(res.headers.entries()),
    body: text,
    raw: null,
  }
}

const { builtinSearch } = await import('../src/music-sdk/index.js')

for (const sourceId of ['wy', 'tx', 'kw', 'kg', 'mg']) {
  try {
    const res = await builtinSearch(sourceId, '周杰伦', 1)
    console.log(`[${sourceId}] OK list=${res.list.length} first=${res.list[0]?.name} - ${res.list[0]?.singer}`)
  } catch (err) {
    console.log(`[${sourceId}] FAILED:`, err.message)
  }
}

const LxRuntime = (await import('../src/runtime/lx-runtime.js')).default
const runtime = new LxRuntime()
const script = await readFile('sources/xinghai.js', 'utf-8')
await runtime.loadSource(script)

const m = await import('../src/music-sdk/index.js')
const res = await m.builtinSearch('wy', '周杰伦', 1)
const song = res.list[0]
const url = await runtime.getMusicUrl('wy', song, '128k')
console.log('[tauri-mode] wy play url:', (url || '').slice(0, 90))
const mgRes = await m.builtinSearch('mg', '圣诞星', 1)
const mgSong = mgRes.list[0]
const mgUrl = await runtime.getMusicUrl('mg', mgSong, '128k')
console.log('[tauri-mode] mg play url:', (mgUrl || '').slice(0, 90))