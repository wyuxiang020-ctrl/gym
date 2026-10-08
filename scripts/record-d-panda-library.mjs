import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const output = `evals/virtual-companion/d-panda/library-recording-${Date.now()}`
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const recordings = []
try {
  for (const [group, first, last, duration] of [['actions', 'idle', 'jump', 1650], ['expressions', 'expression-1', 'expression-12', 2600]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block', recordVideo: { dir: output, size: { width: 1440, height: 1200 } } })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:4175/?companion-lab=1&clip=${first}`)
    await page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
    await page.getByLabel('播放方式', { exact: true }).selectOption('sequence')
    await page.locator('.gentle-play').click()
    await page.waitForFunction(({ last, duration }) => document.querySelector('main')?.dataset.clip === last && Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === duration, { last, duration }, { timeout: 90000 })
    await page.waitForTimeout(400)
    const video = page.video(); await context.close()
    await video.saveAs(`${output}/${group}-normal-speed.webm`)
    if (errors.length) throw new Error(errors.join('\n'))
    recordings.push(`${group}-normal-speed.webm`)
    console.log(`${group}: complete`)
  }
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, recordings, note: 'Real-time browser recordings. Scene selection is a clip switch, not a continuous character pose transition.' }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, recordings }))
} finally { await browser.close() }
