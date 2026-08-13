const puppeteer = require('puppeteer-core')
const path = require('path')

async function main() {
  const outDir = path.join(__dirname, '..', 'theme-screenshots')
  const fs = require('fs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // 1. Dark theme - search page
  console.log('1. Dark theme - search page')
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 })
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark') })
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: path.join(outDir, 'final-search-dark.png') })

  // 2. Ocean theme - search page
  console.log('2. Ocean theme - search page')
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'ocean') })
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: path.join(outDir, 'final-search-ocean.png') })

  // 3. Matcha theme - search page
  console.log('3. Matcha theme - search page')
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'matcha') })
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: path.join(outDir, 'final-search-matcha.png') })

  // 4. Rose theme - search page
  console.log('4. Rose theme - search page')
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'rose') })
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: path.join(outDir, 'final-search-rose.png') })

  // 5. Light theme - settings
  console.log('5. Light theme - settings')
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle0', timeout: 15000 })
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light') })
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: path.join(outDir, 'final-settings-light.png') })

  await browser.close()
  console.log('\nDone!')
}

main().catch(err => { console.error(err); process.exit(1) })
