const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3210';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('\n🎵 Vaelen Music — Automated Tests\n');

  // ── Backend API Tests ──
  console.log('Backend API:');

  await test('GET /api/sources returns success', async () => {
    const res = await fetch(`${API_URL}/api/sources`);
    const data = await res.json();
    assert(data.success === true, 'success was not true');
  });

  await test('Sources list contains expected entries', async () => {
    const res = await fetch(`${API_URL}/api/sources`);
    const data = await res.json();
    assert(Array.isArray(data.sources), 'sources is not an array');
    assert(data.sources.length >= 1, 'no sources loaded');
  });

  await test('Source has required fields (id, name, qualitys)', async () => {
    const res = await fetch(`${API_URL}/api/sources`);
    const data = await res.json();
    const src = data.sources[0];
    assert(src.id, 'missing id');
    assert(src.name, 'missing name');
    assert(Array.isArray(src.qualitys), 'qualitys is not array');
  });

  await test('Custom source (qs) supports search', async () => {
    const res = await fetch(`${API_URL}/api/sources`);
    const data = await res.json();
    const qs = data.sources.find(s => s.id === 'qs');
    assert(qs, 'qs source not found');
    const actions = qs.actions || [];
    assert(actions.includes('musicSearch') || actions.includes('search'), 'qs does not support search');
  });

  // ── Frontend Tests ──
  console.log('\nFrontend UI:');

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await test('Page loads and title is correct', async () => {
      // 使用 domcontentloaded + 显式等待（避免外部字体/CDN 请求阻塞 networkidle）
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();
      assert(title === 'Vaelen Music', `title was "${title}"`);
    });

    await test('Sidebar renders with brand text', async () => {
      const brand = await page.$eval('.brand-text', el => el.textContent);
      assert(brand.includes('Vaelen'), `brand text was "${brand}"`);
    });

    await test('Navigation items are present', async () => {
      const navItems = await page.$$('.nav-item');
      assert(navItems.length === 5, `expected 5 nav items, got ${navItems.length}`);
    });

    await test('Songlist page loads playlists', async () => {
      try {
        await page.click('a[href="/songlists"]');
        await sleep(6000);
        const cards = await page.$$('.playlist-card');
        assert(cards.length > 0, `expected playlists, got ${cards.length}`);
        const tabs = await page.$$('.source-tabs button');
        assert(tabs.length >= 5, `expected platform tabs, got ${tabs.length}`);
      } finally {
        await page.click('a[href="/"]').catch(() => {});
        await sleep(1500);
      }
    });

    await test('Leaderboard page loads boards', async () => {
      try {
        await page.click('a[href="/leaderboard"]');
        await sleep(6000);
        const items = await page.$$('.board-item');
        assert(items.length > 0, `expected boards, got ${items.length}`);
      } finally {
        await page.click('a[href="/"]').catch(() => {});
        await sleep(1500);
      }
    });

    await test('Search input is visible', async () => {
      const input = await page.$('[data-testid="search-input"]');
      assert(input !== null, 'search input not found');
    });

    await test('Source select is populated', async () => {
      await sleep(3000);
      const sel = await page.$('[data-testid="source-select"]');
      assert(sel !== null, 'source select not found');
      const options = await sel.$$eval('option', opts => opts.length);
      assert(options >= 1, `expected at least 1 option, got ${options}`);
    });

    await test('Select qs source for search', async () => {
      await page.select('[data-testid="source-select"]', 'qs');
      await sleep(500);
      const val = await page.$eval('[data-testid="source-select"]', el => el.value);
      assert(val === 'qs', `source was "${val}"`);
    });

    await test('Search for a song returns results', async () => {
      await page.type('[data-testid="search-input"]', '周杰伦');
      await page.click('[data-testid="search-btn"]');
      await sleep(5000);
      const rows = await page.$$('.song-table tbody tr');
      assert(rows.length > 0, 'no search results returned');
    });

    await test('Song table shows song data', async () => {
      const firstRow = await page.$('.song-table tbody tr');
      assert(firstRow !== null, 'no rows found');
      const text = await firstRow.evaluate(el => el.textContent);
      assert(text.length > 0, 'row is empty');
    });

    await test('Quality buttons are functional', async () => {
      const btn = await page.$('[data-testid="quality-320k"]');
      assert(btn !== null, '320k quality button not found');
      await btn.click();
      const isActive = await btn.evaluate(el => el.classList.contains('active'));
      assert(isActive, '320k button not active after click');
    });

    await test('Navigate to Lists page', async () => {
      await page.click('a[href="/lists"]');
      await sleep(500);
      const h1 = await page.$eval('.content-header h1', el => el.textContent);
      assert(h1.includes('列表'), `h1 was "${h1}"`);
    });

    await test('Navigate to Settings page', async () => {
      await page.click('a[href="/settings"]');
      await sleep(500);
      const h1 = await page.$eval('.content-header h1', el => el.textContent);
      assert(h1.includes('设置'), `h1 was "${h1}"`);
    });

    await test('Settings sections are present', async () => {
      const sections = await page.$$('.settings-section');
      assert(sections.length >= 3, `expected at least 3 sections, got ${sections.length}`);
    });

    await test('Player bar is present', async () => {
      const player = await page.$('[data-testid="player"]');
      assert(player !== null, 'player bar not found');
    });

    await test('Player title shows default text', async () => {
      const title = await page.$eval('[data-testid="player-title"]', el => el.textContent);
      assert(title.includes('未播放'), `player title was "${title}"`);
    });

    await test('Play button is clickable', async () => {
      const playBtn = await page.$('[data-testid="play-btn"]');
      assert(playBtn !== null, 'play button not found');
    });

    await test('Screenshot captured', async () => {
      await page.screenshot({ path: 'D:\\moved_data2\\sonar-music\\tests\\screenshot.png', fullPage: false });
    });

    await browser.close();
  } catch (err) {
    console.error(`  Fatal error: ${err.message}`);
    if (browser) await browser.close();
    failed++;
  }

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}`);
  console.log(`${'═'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
})();
