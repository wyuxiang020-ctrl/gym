import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const out = `evals/virtual-companion/v4-illustrated/pose-sheet-${Date.now()}`
mkdirSync(out, { recursive: true })
const { chromium } = await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ serviceWorkers: 'block' })
await context.route('**/*', r => new URL(r.request().url()).origin === 'http://127.0.0.1:4175' && !/api|companion-assets/.test(new URL(r.request().url()).pathname) ? r.continue() : r.abort())
try {
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4175/?companion-lab=1')
  const png = await page.evaluate(async () => {
    const { drawIllustratedPanda } = await import('/src/companion/illustratedPanda.ts')
    const { characterPose } = await import('/src/companion/characterMotion.ts')
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 810
    const c = canvas.getContext('2d'); c.fillStyle = '#faf8f1'; c.fillRect(0, 0, 1080, 810)
    const poses = [['idle', 1200, true, 'three-quarter'], ['fold', 3000, false, 'three-quarter'], ['wave', 2200, true, 'side'], ['hop', 1650, false, 'three-quarter'], ['shuffle', 2200, true, 'three-quarter'], ['stretch', 3000, false, 'three-quarter']]
    for (let i = 0; i < poses.length; i++) {
      const [action, time, hat, view] = poses[i]
      c.save(); c.translate(i % 3 * 360, Math.floor(i / 3) * 375); c.scale(.6, .6)
      drawIllustratedPanda(c, characterPose(time, action), { view, hat }); c.restore()
    }
    c.fillStyle = '#697261'; c.font = '18px Microsoft YaHei'; c.textAlign = 'center'
    c.fillText('V4.3 · 实际动画姿势截帧', 540, 780)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  writeFileSync(`${out}/actual-poses.png`, Buffer.from(png, 'base64'))
  console.log(out)
} finally { await context.close(); await browser.close() }
