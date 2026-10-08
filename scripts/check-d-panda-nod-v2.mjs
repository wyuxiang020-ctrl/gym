import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { actionPose, deformAction } from '../src/companion/actionMotion.ts'

const output = `evals/virtual-companion/d-panda/nod-v2-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const checks = []
const peak = actionPose('encourage', 1030)
const landmarks = { forehead: [200, 30], nose: [219, 182], chin: [210, 228], leftPaw: [50, 320], rightPaw: [307, 342] }
const offsets = Object.fromEntries(Object.entries(landmarks).map(([name, [x, y]]) => {
  const point = deformAction('encourage', x, y, peak)
  return [name, [point[0] - x, point[1] - y]]
}))
assert.ok(offsets.nose[1] - offsets.forehead[1] > 2, 'Nod needs face parallax, not whole-head translation')
assert.ok(offsets.nose[1] - offsets.chin[1] > 2, 'Chin must tuck relative to the facial plane')
for (const offset of Object.values(offsets)) assert.equal(offset[0], 0, 'No sideways head sway')
assert.ok(Math.abs(offsets.leftPaw[1]) < .1 && Math.abs(offsets.rightPaw[1]) < .1)
checks.push({ name: '鼻尖、前额与下巴具有小幅视差，横向位移为 0，双爪没有抬起', result: 'PASS', offsets })

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=actions')
  const ready = () => page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  const seek = async time => {
    await page.getByRole('slider', { name: '样片进度' }).fill(String(time))
    await page.waitForFunction(value => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === value, time)
  }
  await ready()
  assert.equal(await page.locator('main').getAttribute('data-nod-revision'), '2')
  for (const time of [0, 460, 760, 1030, 1510, 1940, 3000]) {
    await seek(time)
    await page.locator('.actions-plane').screenshot({ path: `${output}/nod-${time}.png` })
  }
  const pixels = png => sharp(png).raw().toBuffer()
  assert.deepEqual(await pixels(`${output}/nod-0.png`), await pixels(`${output}/nod-3000.png`))
  checks.push({ name: '当前页面为第二版点头，起止截图完全一致', result: 'PASS' })
  const baseline = 'evals/virtual-companion/d-panda/actions-check-1791449103815'
  for (const [id, times] of [['hat', [0, 1380, 2840, 3600]], ['stretch', [0, 2260, 3960, 5000]]]) {
    await page.locator(`[data-action-choice="${id}"]`).click(); await ready()
    for (const time of times) {
      await seek(time)
      const screenshot = await page.locator('.actions-plane').screenshot()
      assert.deepEqual(await pixels(screenshot), await pixels(readFileSync(`${baseline}/${id}-${time}.png`)), `${id}/${time}: unrelated action changed`)
    }
  }
  assert.deepEqual(errors, [])
  checks.push({ name: '扶帽与伸展共 8 个原有截帧逐像素未变，无脚本错误', result: 'PASS' })
  await context.close()
  const recorded = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block', recordVideo: { dir: output, size: { width: 1440, height: 1200 } } })
  await recorded.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const movie = await recorded.newPage()
  await movie.goto('http://127.0.0.1:4175/?companion-lab=1&review=actions')
  await movie.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  await movie.locator('.gentle-play').click()
  await movie.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === 3000)
  await movie.waitForTimeout(450)
  const video = movie.video(); await recorded.close(); await video.saveAs(`${output}/nod-v2-normal-speed.webm`)
  checks.push({ name: '已录制第二版点头正常速度页面录像', result: 'PASS' })
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2)); throw error
} finally { await browser.close() }
