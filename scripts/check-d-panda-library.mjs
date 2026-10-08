import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { ALL_CLIPS, MOTION_CLIPS, EXPRESSION_CLIPS } from '../src/companion/companionCatalog.ts'
import { librarySample } from '../src/companion/libraryMotion.ts'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const output = `evals/virtual-companion/d-panda/library-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const checks = [], pass = (name, data = {}) => checks.push({ name, result: 'PASS', ...data })
const geometry = []
assert.equal(MOTION_CLIPS.length, 11); assert.equal(EXPRESSION_CLIPS.length, 12)
for (const clip of ALL_CLIPS) {
  const nx = Math.ceil(clip.crop[2] / 6), ny = Math.ceil(clip.crop[3] / 5), dx = clip.crop[2] / nx, dy = clip.crop[3] / ny
  let minArea = Infinity, maxStep = 0
  const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  for (const reduced of [false, true]) {
    for (const t of [...Array.from({ length: Math.ceil(clip.duration / 50) }, (_, i) => i * 50), clip.duration]) {
      const sample = librarySample(clip, t, reduced), next = librarySample(clip, Math.min(clip.duration, t + 16), reduced)
      for (let row = 0; row < ny; row++) for (let column = 0; column < nx; column++) {
        const x = column * dx, y = row * dy
        const a = sample.deform(x, y), b = sample.deform(x + dx, y), c = sample.deform(x, y + dy), d = sample.deform(x + dx, y + dy)
        minArea = Math.min(minArea, area(a, b, c), area(b, d, c))
        const p = next.deform(x, y); maxStep = Math.max(maxStep, Math.hypot(a[0] - p[0], a[1] - p[1]))
        if (t === 0 || t === clip.duration) assert.ok(Math.hypot(a[0] - x, a[1] - y) < 1e-7, `${clip.id}: endpoints`)
      }
      for (const x of [0, 100, clip.crop[2] - 10]) {
        const point = sample.deform(x, clip.footY + 1)
        assert.ok(Math.abs(point[0] - x) < 1e-9)
        assert.ok(Math.abs(point[1] - (clip.footY + 1 - sample.lift)) < 1e-9)
      }
      if (reduced) assert.equal(sample.lift, 0)
    }
  }
  geometry.push({ id: clip.id, minArea, maxStep })
  assert.ok(minArea > 0, `${clip.id}: folded mesh ${minArea}`)
  assert.ok(maxStep < 7, `${clip.id}: movement discontinuity ${maxStep}`)
}
pass('23 段正常/减少动态：起止复位、网格无翻折、接地与跳跃约束', { geometry })
const hash = value => createHash('sha256').update(value).digest('hex')
const manifest = JSON.parse(readFileSync('public/companion-assets/d-panda/library/manifest.json', 'utf8'))
for (const selection of manifest.selections) {
  const source = readFileSync(`docs/virtual-companion-v4/panda-ip-handoff-2026-10-08/assets/${selection.file}`)
  assert.equal(hash(source), selection.sha256)
  const svg = readFileSync(`public/companion-assets/d-panda/library/${selection.id}-original.svg`, 'utf8')
  assert.deepEqual(Buffer.from(svg.match(/href="data:image\/png;base64,([^"]+)"/)[1], 'base64'), source)
  assert.ok(!/<filter|<text|<animate/.test(svg))
}
pass('19 个新增素材内嵌完整原 PNG，未重画或替换源图')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  const page = await context.newPage(), errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => { const url = new URL(route.request().url()); requests.push(url.pathname); return url.hostname === '127.0.0.1' ? route.continue() : route.abort() })
  await context.addInitScript(() => {
    window.__camera = 0; window.__writes = 0
    navigator.mediaDevices.getUserMedia = async () => { window.__camera++; throw new Error('No camera') }
    Storage.prototype.setItem = () => { window.__writes++; throw new Error('No writes') }
  })
  const ready = () => page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  const seek = async value => {
    await page.getByRole('slider', { name: '播放进度', exact: true }).fill(String(value))
    await page.waitForFunction(t => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === t, value)
  }
  const pixels = png => sharp(png).raw().toBuffer()
  for (const clip of ALL_CLIPS) {
    await page.goto(`http://127.0.0.1:4175/?companion-lab=1&clip=${clip.id}`); await ready()
    assert.equal(await page.locator('main').getAttribute('data-clip'), clip.id)
    const actualPixels = await page.evaluate(async clip => {
      const decode = async (url, source) => {
        const img = new Image(); img.src = url; await img.decode()
        const canvas = document.createElement('canvas'); canvas.width = clip.crop[2]; canvas.height = clip.crop[3]
        const ctx = canvas.getContext('2d'); if (source) ctx.drawImage(img, ...clip.crop, 0, 0, canvas.width, canvas.height); else ctx.drawImage(img, 0, 0)
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data
      }
      const a = await decode('/companion-assets/d-panda/design/' + clip.source, true), b = await decode('/companion-assets/d-panda/' + clip.texture, false)
      let opaque = 0, changed = 0
      for (let i = 0; i < b.length; i += 4) if (b[i + 3] === 255) { opaque++; if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) changed++ }
      const alpha = (x, y) => b[(Math.floor(y) * clip.crop[2] + Math.floor(x)) * 4 + 3]
      return { opaque, changed, faceAlpha: alpha(clip.crop[2] * .5, clip.crop[3] * .4), bellyAlpha: alpha(clip.crop[2] * .5, clip.crop[3] * .86), neighborAlpha: alpha(20, 160), neighborHatAlpha: alpha(290, 290) }
    }, clip)
    assert.equal(actualPixels.changed, 0); assert.ok(actualPixels.opaque > 30000)
    if (clip.category === 'expressions') { assert.equal(actualPixels.faceAlpha, 255, `${clip.id}: missing face`); assert.equal(actualPixels.bellyAlpha, 255, `${clip.id}: missing belly`) }
    if (clip.id === 'rest') assert.equal(actualPixels.neighborAlpha, 0, 'Neighboring artwork must be excluded')
    if (clip.id === 'celebrate') assert.equal(actualPixels.neighborHatAlpha, 0, 'Neighboring hat must be excluded')
    const start = await page.locator('.library-plane').screenshot({ animations: 'disabled', path: `${output}/${clip.id}-0.png` })
    await seek(clip.checkpoints[1][1]); await page.locator('.library-plane').screenshot({ animations: 'disabled', path: `${output}/${clip.id}-peak.png` })
    await seek(clip.duration)
    const endPixels = await pixels(await page.locator('.library-plane').screenshot({ animations: 'disabled' }))
    assert.ok(endPixels.equals(await pixels(start)), `${clip.id}: end frame`)
  }
  pass('23 段素材不透明像素原色一致，页面起止截帧一致，峰值截图已保存')
  await page.goto('http://127.0.0.1:4175/?companion-lab=1'); await ready()
  await page.locator('.gentle-play').click(); await page.waitForTimeout(320); await page.locator('.gentle-play').click()
  const frozen = await page.locator('.idle-canvas').evaluate(canvas => canvas.toDataURL())
  await page.waitForTimeout(220); assert.equal(await page.locator('.idle-canvas').evaluate(canvas => canvas.toDataURL()), frozen)
  await page.getByRole('button', { name: '原图对照', exact: true }).click(); assert.equal(await page.locator('.gentle-reference').count(), 1)
  await page.getByRole('button', { name: '返回动画', exact: true }).click()
  pass('暂停冻结同帧、原图对照与回到动画可用')
  await page.getByLabel('播放方式', { exact: true }).selectOption('loop')
  await seek(2900); await page.locator('.gentle-play').click(); await page.waitForTimeout(220)
  assert.ok(Number(await page.locator('.idle-canvas').getAttribute('data-frame-time')) < 1000)
  await page.locator('[data-clip-choice="hat"]').click(); await page.locator('.library-pending').waitFor()
  await page.getByRole('button', { name: '取消', exact: true }).click(); assert.equal(await page.locator('.library-pending').count(), 0)
  await page.locator('[data-clip-choice="hat"]').click()
  await page.waitForFunction(() => document.querySelector('main')?.dataset.clip === 'hat'); await ready()
  assert.equal(await page.locator('.library-stage').getAttribute('data-playing'), 'false')
  pass('循环端点续播、播放中选择等待收稳、取消与安全切换')
  await page.getByLabel('播放方式', { exact: true }).selectOption('sequence')
  await seek(1700); await page.locator('.gentle-play').click()
  await page.waitForFunction(() => document.querySelector('main')?.dataset.clip === 'stretch'); await ready()
  await page.waitForFunction(() => document.querySelector('.library-stage')?.dataset.playing === 'true')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForFunction(() => document.querySelector('.library-stage')?.dataset.playing === 'false')
  pass('顺序播放自动开始下一段，页面隐藏立即暂停')
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&clip=jump'); await ready()
  await page.getByRole('checkbox', { name: '减少动态' }).check(); await seek(750)
  assert.equal(await page.locator('.library-stage').getAttribute('data-reduced'), 'true')
  await page.getByText('仔细看看 · 逐帧与背景', { exact: true }).click()
  await page.getByRole('button', { name: '深色', exact: true }).click()
  await page.locator('.library-plane').screenshot({ path: `${output}/jump-reduced-dark.png` })
  await page.getByRole('button', { name: '下一帧', exact: true }).click()
  assert.ok(Number(await page.locator('.idle-canvas').getAttribute('data-frame-time')) > 750)
  pass('减少动态、背景与逐帧控制')
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&clip=wave'); await ready()
  await page.screenshot({ animations: 'disabled', path: `${output}/desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ animations: 'disabled', path: `${output}/mobile.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  pass('桌面与 390 像素移动布局，无横向溢出')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&clip=expression-11'); await ready()
  await page.getByText('仔细看看 · 逐帧与背景', { exact: true }).click()
  await page.getByRole('button', { name: '深色', exact: true }).click()
  await seek(800); await page.locator('.library-plane').screenshot({ path: `${output}/expression-11-dark.png` })
  await page.getByLabel('播放方式', { exact: true }).selectOption('sequence')
  await seek(1700); await page.locator('.gentle-play').click()
  await page.waitForFunction(() => document.querySelector('main')?.dataset.clip === 'expression-12'); await ready()
  await seek(2500); await page.locator('.gentle-play').click()
  await page.waitForFunction(() => document.querySelector('.library-stage')?.dataset.playing === 'false')
  assert.equal(await page.getByLabel('播放方式', { exact: true }).inputValue(), 'once')
  assert.equal(Number(await page.locator('.idle-canvas').getAttribute('data-frame-time')), 2600)
  pass('顺序播放最后一段完成后停止，不重置或意外自动重播')
  await page.evaluate(() => document.querySelector('.idle-canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext())
  await page.getByRole('alert').waitFor(); assert.equal(await page.locator('.gentle-play').isDisabled(), true)
  await page.getByRole('button', { name: '重新加载', exact: true }).click(); await ready()
  pass('WebGL 中断有提示，重新加载新画布后可恢复')
  await page.route('**/library/bow-original.svg', route => route.abort())
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&clip=bow')
  await page.getByRole('alert').waitFor()
  await page.getByRole('button', { name: '原图对照', exact: true }).click()
  assert.equal(await page.locator('.gentle-reference').count(), 1)
  await page.unroute('**/library/bow-original.svg')
  await page.getByRole('button', { name: '返回动画', exact: true }).click()
  await page.getByRole('button', { name: '重新加载', exact: true }).click(); await ready()
  pass('素材加载失败可查看原图并重试恢复')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&clip=unknown'); await ready()
  assert.equal(await page.locator('main').getAttribute('data-clip'), 'idle')
  assert.equal(await page.getByRole('checkbox', { name: '减少动态' }).isChecked(), true)
  assert.equal(await page.locator('.library-stage').getAttribute('data-playing'), 'false')
  pass('未知片段安全回待机，遵循系统减少动态，默认不自动播放')
  assert.deepEqual(errors, [])
  assert.deepEqual(await page.evaluate(() => [window.__camera, window.__writes]), [0, 0])
  assert.ok(!requests.some(path => /dpanda\/|pose-worker|pose_landmarker|three/.test(path)))
  pass('无脚本错误，无相机调用、训练存储写入或旧绘制模块')
  await context.close()
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2)); throw error
} finally { await browser.close() }
