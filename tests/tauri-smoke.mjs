import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LxRuntime = (await import('../src/runtime/lx-runtime.js')).default

const runtime = new LxRuntime()

async function main() {
  const dir = path.join(__dirname, '..', 'sources')
  for (const file of ['feichangdao.js']) {
    try {
      const content = readFileSync(path.join(dir, file), 'utf8')
      const init = await runtime.loadSource(content)
      console.log(`[OK] Loaded ${file} -> sources: ${Object.keys(init?.sources || {}).join(', ')}`)
    } catch (err) {
      console.log(`[FAIL] ${file}: ${err.message}`)
      process.exit(1)
    }
  }

  const list = await runtime.getSourceList()
  console.log(`[OK] Source list (${list.length}): ${list.map(s => `${s.id}[${s.actions.join(',')}]`).join(', ')}`)

  for (const id of ['wy', 'kw']) {
    try {
      const result = await runtime.search(id, '周杰伦', 1)
      const songs = (result && result.list) || []
      console.log(`[OK] ${id} search returned ${songs.length} songs`)
      if (songs.length > 0) {
        const song = songs[0]
        console.log(`[OK] First song: ${song.name} - ${song.singer}`)
        try {
          const url = await runtime.getMusicUrl(id, song, '128k')
          console.log(`[OK] ${id} Music URL: ${String(url).substring(0, 100)}`)
        } catch (e) {
          console.log(`[FAIL] ${id} musicUrl: ${e.message}`)
        }
      }
    } catch (err) {
      console.log(`[INFO] ${id} search failed: ${err.message}`)
    }
  }

  console.log('[DONE] smoke test finished')
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})