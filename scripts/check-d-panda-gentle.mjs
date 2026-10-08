import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const output = `evals/virtual-companion/d-panda/gentle-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const checks = []
const assets = 'public/companion-assets/d-panda/gentle'
const original = readFileSync('public/companion-assets/d-panda/design/D2-character-accessories.png')
const originalHash = createHash('sha256').update(original).digest('hex')
assert.equal(originalHash, '213e4988d57259b0efa4a60c907e098eefc42dc5d1c86b59f4c8ce3bc01f6ff4')
for (const file of ['stand-original.svg', 'ground-original.svg']) {
  const svg = readFileSync(`${assets}/${file}`, 'utf8')
  const embedded = Buffer.from(svg.match(/href="data:image\/png;base64,([^"]+)"/)[1], 'base64')
  assert.deepEqual(embedded, original)
  assert.equal((svg.match(/<image /g) ?? []).length, 1)
  assert.ok(!/filter=|<filter|<text|<animate/.test(svg))
}
checks.push({ name: '透明素材只添加遮罩，内嵌 PNG 与确认原图逐字节一致', result: 'PASS' })
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  const requests = [], errors = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname)
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=gentle-v1')
  const play = page.getByRole('button', { name: '播放 4.8 秒样片', exact: true })
  await play.waitFor()
  await page.waitForFunction(() => !document.querySelector('.gentle-play')?.disabled)
  assert.equal(await page.locator('main').getAttribute('data-playing'), 'false')
  const pixels = await page.evaluate(async () => {
    async function decode(url, source = false) {
      const image = new Image(); image.src = url; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 475
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (source) context.drawImage(image, 50, 140, 390, 475, 0, 0, 390, 475)
      else context.drawImage(image, 0, 0, 390, 475)
      return context.getImageData(0, 0, 390, 475).data
    }
    const source = await decode('/companion-assets/d-panda/design/D2-character-accessories.png', true)
    const masked = await decode('/companion-assets/d-panda/gentle/stand-original.svg')
    let opaque = 0, changed = 0, transparent = 0, partial = 0
    for (let i = 0; i < masked.length; i += 4) {
      if (masked[i + 3] === 255) {
        opaque++
        if (source[i] !== masked[i] || source[i + 1] !== masked[i + 1] || source[i + 2] !== masked[i + 2]) changed++
      } else if (!masked[i + 3]) transparent++; else partial++
    }
    return { opaque, changed, transparent, partial }
  })
  assert.equal(pixels.changed, 0); assert.ok(pixels.opaque > 100000); assert.ok(pixels.transparent > 70000)
  checks.push({ name: '浏览器解码后，不透明角色像素 RGB 与原图一致；存在真实透明背景', ...pixels, result: 'PASS' })
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  for (const name of ['深色', '透明棋盘', '浅色']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.locator('.gentle-plane').screenshot({ path: `${output}/edge-${name === '深色' ? 'dark' : name === '浅色' ? 'paper' : 'checker'}.png` })
  }
  await play.click()
  await page.waitForFunction(() => Number(document.querySelector('.gentle-timeline input')?.value) > 900)
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  const paused = await page.locator('.gentle-timeline input').inputValue()
  const matrix = () => page.locator('.gentle-sprite').evaluate(node => {
    const matrix = new DOMMatrix(getComputedStyle(node).transform)
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI }
  })
  const before = await matrix()
  await page.waitForTimeout(200)
  assert.equal(await page.locator('.gentle-timeline input').inputValue(), paused)
  assert.deepEqual(await matrix(), before)
  const pausedClock = await page.locator('.gentle-sprite').evaluate(node => Number(node.getAnimations()[0].currentTime))
  await page.getByRole('button', { name: '下一帧', exact: true }).click()
  const nextClock = await page.locator('.gentle-sprite').evaluate(node => Number(node.getAnimations()[0].currentTime))
  assert.ok(Math.abs(nextClock - pausedClock - 1000 / 30) < 0.02)
  checks.push({ name: '按需播放、暂停冻结、逐帧前进', result: 'PASS' })
  const samples = []
  for (const time of [0, 1344, 2400, 2880, 4368, 4800]) {
    await page.getByRole('slider', { name: '样片进度' }).fill(String(time))
    const pose = await matrix(); samples.push({ time, ...pose })
    assert.ok(Math.abs(pose.a * pose.d - pose.b * pose.c - 1) < 0.00001, 'No scale or deformation')
    assert.ok(Math.abs(pose.a - pose.d) < 0.000001 && Math.abs(pose.b + pose.c) < 0.000001)
    assert.equal(pose.e, 0); assert.equal(pose.f, 0)
    assert.ok(Math.abs(pose.angle) <= 1.201)
    await page.locator('.gentle-plane').screenshot({ path: `${output}/frame-${time}.png` })
  }
  assert.equal(samples[0].angle, 0); assert.equal(samples.at(-1).angle, 0)
  checks.push({ name: '全身只旋转、固定大小，最大 1.2°，开始结束准确回正', samples, result: 'PASS' })
  await page.getByRole('button', { name: '同位置原图', exact: true }).click()
  assert.equal(await page.locator('.gentle-timeline input').inputValue(), '0')
  assert.ok(await page.locator('.gentle-reference').isVisible())
  const referenceBox = await page.locator('.gentle-reference').boundingBox()
  await page.getByRole('button', { name: '透明角色', exact: true }).click()
  assert.deepEqual(await page.locator('.gentle-sprite').boundingBox(), referenceBox)
  await page.getByRole('button', { name: '播放 4.8 秒样片', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector('.gentle-timeline input')?.value) === 4800)
  assert.equal(await page.locator('main').getAttribute('data-playing'), 'false')
  assert.equal((await matrix()).angle, 0)
  checks.push({ name: '同位置原图对照；4.8 秒播放一次并停在原位', result: 'PASS' })
  await page.getByRole('button', { name: '重新播放', exact: true }).click()
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  assert.equal(await page.locator('main').getAttribute('data-playing'), 'false')
  await page.evaluate(() => { delete document.hidden })
  await page.getByRole('button', { name: '回到原位', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  assert.equal(await page.locator('canvas,video').count(), 0)
  assert.deepEqual(requests.filter(path => /\/dpanda\/|\/mirror\/|PandaStage|\.wasm$|pose_landmarker/.test(path)), [])
  assert.deepEqual(errors, [])
  checks.push({ name: '隐藏暂停、手机宽度无溢出、不加载旧角色或镜像、无脚本错误', result: 'PASS' })
  await page.route('**/companion-assets/d-panda/gentle/*.svg', route => route.abort())
  await page.reload()
  await page.getByRole('alert').waitFor()
  assert.ok(await page.getByRole('button', { name: '播放 4.8 秒样片', exact: true }).isDisabled())
  checks.push({ name: '素材失败明确提示，阻止空白播放', result: 'PASS' })
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2))
  throw error
} finally { await browser.close() }
