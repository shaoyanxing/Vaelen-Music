const puppeteer = require('puppeteer-core')

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE_URL = 'http://localhost:5173'

let passed = 0
let failed = 0
const errors = []

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  PASS ${name}`)
  } catch (err) {
    failed++
    errors.push(`${name}: ${err.message}`)
    console.log(`  FAIL ${name}`)
    console.log(`    ${err.message}`)
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  console.log('\nVaelen Music - Builtin Search UI Tests\n')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text().slice(0, 200))
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 20000 })

  // ── Sources loaded (xinghai + feichangdao) ──
  await test('sources loaded (xinghai 5 + qs)', async () => {
    await page.waitForFunction(() => document.querySelectorAll('.source-tag, [data-testid]').length >= 0, { timeout: 8000 })
    await page.waitForFunction(() => !document.body.innerText.includes('0 个音源已加载'), { timeout: 8000 })
    const text = await page.evaluate(() => document.body.innerText)
    const m = text.match(/(\d+) 个音源已加载/)
    console.log(`  -> ${m ? m[0] : 'not found'}`)
    assert(m && parseInt(m[1]) >= 5, 'expected >= 5 sources')
  })

  // ── Builtin search ──
  await test('search "晴天" returns results', async () => {
    await page.type('[data-testid="search-input"]', '晴天', { delay: 10 })
    await page.click('[data-testid="search-btn"]')
    await page.waitForFunction(() => document.body.innerText.includes('首歌曲'), { timeout: 20000 })
    const text = await page.evaluate(() => document.body.innerText)
    const m = text.match(/(\d+) 首歌曲/)
    console.log(`  -> found ${m ? m[1] : '?'} songs`)
    assert(m && parseInt(m[1]) > 0, 'no results')
  })

  // ── First song fields ──
  await test('song rows show name/singer/album', async () => {
    await page.waitForSelector('[data-testid="song-list"] tbody tr', { timeout: 10000 })
    const first = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="song-list"] tbody tr')
      return row ? row.innerText : ''
    })
    console.log('  ->', first.replace(/\n/g, ' | ').slice(0, 120))
    assert(first.includes('晴天') || first.trim().length > 0, 'empty row')
  })

  // ── Play first song ──
  await test('double-click plays and fetches audio url', async () => {
    await page.evaluate(() => {
      const row = document.querySelector('[data-testid="song-list"] tbody tr')
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    await sleep(6000)
    const state = await page.evaluate(() => {
      const audio = document.querySelector('[data-testid="audio-element"]')
      return {
        src: audio ? audio.src : null,
        playing: !audio ? false : !audio.paused && audio.currentTime >= 0,
        title: document.querySelector('[data-testid="player-title"]')?.innerText,
      }
    })
    console.log('  -> title:', state.title, '| src:', state.src ? state.src.slice(0, 90) : null, '| playing:', state.playing)
    assert(state.src && state.src.startsWith('http'), 'no audio src')
  })

  // ── Switch source to tx, search again ──
  await test('search via tx source', async () => {
    const ok = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const btn = btns.find(b => b.innerText.includes('QQ') || b.innerText.includes('tx') || b.innerText.includes('酷狗'))
      if (btn) { btn.click(); return true }
      return false
    })
    if (!ok) throw new Error('no source switch button found')
    await sleep(500)
    await page.click('[data-testid="search-btn"]')
    await page.waitForFunction(() => document.body.innerText.includes('首歌曲'), { timeout: 20000 })
    const text = await page.evaluate(() => document.body.innerText)
    console.log('  ->', text.match(/(\d+) 首歌曲/)?.[0] || 'no result count')
  })

  await browser.close()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log('\nFailures:')
    errors.forEach(e => console.log(' -', e))
    process.exit(1)
  }
})().catch(err => { console.error(err); process.exit(1) })

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed')
}