import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { ACTIONS, actionPose, deformAction } from '../src/companion/actionMotion.ts'

const output = `evals/virtual-companion/d-panda/actions-preview-${Date.now()}`
mkdirSync(output, { recursive: true })
const geometry = []
for (const action of ACTIONS) {
  let minArea = Infinity
  for (let time = 0; time <= action.duration; time += 50) {
    const pose = actionPose(action.id, time)
    for (let x = 0; x < action.crop[2] - 6; x += 6) for (let y = 0; y < action.crop[3] - 5; y += 5) {
      const [ax, ay] = deformAction(action.id, x, y, pose), [bx, by] = deformAction(action.id, x + 6, y, pose), [cx, cy] = deformAction(action.id, x, y + 5, pose)
      minArea = Math.min(minArea, (bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
    }
  }
  geometry.push({ id: action.id, minArea })
}
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=actions')
  for (const action of ACTIONS) {
    await page.locator(`[data-action-choice="${action.id}"]`).click()
    await page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
    for (const time of [0, ...action.checkpoints.map(point => point[1]), action.duration]) {
      await page.getByRole('slider', { name: '样片进度' }).fill(String(time))
      await page.waitForFunction(t => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === t, time)
      await page.locator('.actions-plane').screenshot({ path: `${output}/${action.id}-${time}.png` })
    }
  }
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  writeFileSync(`${output}/result.json`, JSON.stringify({ output, errors, geometry }, null, 2))
  console.log(JSON.stringify({ output, errors, geometry }, null, 2))
} finally { await browser.close() }
