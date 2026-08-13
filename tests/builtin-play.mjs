import { readFile } from 'node:fs/promises'
import LxRuntime from '../src/runtime/lx-runtime.js'
import { builtinSearch } from '../src/music-sdk/index.js'

const runtime = new LxRuntime()

async function main() {
  const script = await readFile('sources/xinghai.js', 'utf-8')
  await runtime.loadSource(script)
  const sources = await runtime.getSourceList()
  console.log('sources:', sources.map(s => s.id).join(', '))

  for (const sourceId of ['wy', 'tx', 'kw', 'kg', 'mg']) {
    try {
      const res = await builtinSearch(sourceId, '周杰伦', 1)
      const song = res.list[0]
      console.log(`\n[${sourceId}] search:`, song.name, '-', song.singer, '| id=', song.meta.songId)
      const url = await runtime.getMusicUrl(sourceId, song, '128k')
      console.log(`[${sourceId}] url:`, (url || '').slice(0, 110))
      const lyric = await runtime.getLyric(sourceId, song)
      console.log(`[${sourceId}] lyric:`, lyric ? String(lyric).slice(0, 60) : 'null')
    } catch (err) {
      console.log(`\n[${sourceId}] FAILED:`, err.message)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })