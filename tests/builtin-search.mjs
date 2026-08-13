import { builtinSearch, BUILTIN_SOURCES, toNewSongInfo } from '../src/music-sdk/index.js'

const sources = ['wy', 'tx', 'kw', 'kg', 'mg']

async function main() {
  console.log('BUILTIN_SOURCES:', BUILTIN_SOURCES.join(', '))
  for (const source of sources) {
    try {
      const res = await builtinSearch(source, '周杰伦', 1)
      console.log(`\n[${source}] total=${res.total} allPage=${res.allPage} list=${res.list.length}`)
      for (const song of res.list.slice(0, 3)) {
        console.log('  ', song.id, '|', song.name, '-', song.singer, '| album:', song.albumName, '| duration:', song.duration, '| meta.songId:', song.meta.songId, '| qualitys:', Object.keys(song.meta._qualitys || {}).join(','))
      }
    } catch (err) {
      console.log(`\n[${source}] FAILED:`, err.message)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })