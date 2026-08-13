const puppeteer = require('puppeteer-core')
const path = require('path')

const themes = ['dark', 'light', 'ocean', 'rose', 'matcha']
const outDir = path.join(__dirname, '..', 'theme-screenshots')

async function main() {
  const fs = require('fs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  for (const theme of themes) {
    console.log(`Taking screenshot for theme: ${theme}`)
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle0', timeout: 15000 })
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      localStorage.setItem('vaelen-theme', t)
    }, theme)
    await new Promise(r => setTimeout(r, 300))

    const screenshotPath = path.join(outDir, `theme-${theme}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    console.log(`  Saved: ${screenshotPath}`)
  }

  // Also take a search page screenshot for dark theme
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 })
  await new Promise(r => setTimeout(r, 300))
  await page.screenshot({ path: path.join(outDir, 'search-dark.png'), fullPage: false })
  console.log('  Saved: search-dark.png')

  await browser.close()
  console.log('\nDone! All screenshots saved to', outDir)
}

main().catch(err => { console.error(err); process.exit(1) })
