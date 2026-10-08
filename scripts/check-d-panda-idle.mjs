import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { deformOriginal, idlePose, IDLE_DURATION } from '../src/companion/idleMotion.ts'

const output = `evals/virtual-companion/d-panda/idle-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const checks = []
const pass = (name, details = {}) => checks.push({ name, ...details, result: 'PASS' })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const assets = 'public/companion-assets/d-panda'
const manifest = JSON.parse(readFileSync(`${assets}/idle/manifest.json`, 'utf8'))
assert.equal(hash(readFileSync(`${assets}/design/${manifest.standingSource}`)), manifest.standingSha256)
assert.equal(hash(readFileSync(`${assets}/design/${manifest.eyeSource}`)), manifest.eyeSourceSha256)
const embedded = Buffer.from(readFileSync(`${assets}/idle/closed-eyes-original.svg`, 'utf8').match(/href="data:image\/png;base64,([^"]+)"/)[1], 'base64')
assert.deepEqual(embedded, readFileSync(`${assets}/design/${manifest.eyeSource}`))
assert.deepEqual(manifest.newPaintedRegions, [])
pass('站姿与表情原文件完整，闭眼素材内嵌原表情 PNG 字节')

let blinkEpisodes = 0, wasClosed = false, smallestArea = Infinity
for (let time = 0; time <= IDLE_DURATION; time += 10) {
  const pose = idlePose(time)
  if (pose.blink > 0 && !wasClosed) blinkEpisodes++
  wasClosed = pose.blink > 0
  for (const x of [0, 70, 195, 325, 390]) for (const y of [422, 447, 475]) assert.deepEqual(deformOriginal(x, y, pose), [x, y])
  const a = deformOriginal(170, 115, pose), b = deformOriginal(250, 130, pose)
  assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - Math.hypot(80, 15)) < 1e-9)
}
assert.equal(blinkEpisodes, 1)
for (const time of [0, 6000]) for (const x of [0, 50, 195, 340, 390]) for (const y of [0, 100, 220, 300, 420, 475]) {
  const point = deformOriginal(x, y, idlePose(time))
  assert.ok(Math.abs(point[0] - x) < 1e-9 && Math.abs(point[1] - y) < 1e-9)
}
for (const time of [0, 1000, 1800, 2370, 2800, 3600, 5000, 6000]) {
  const pose = idlePose(time)
  for (let x = 0; x < 390; x += 6) for (let y = 0; y < 475; y += 5) {
    const a = deformOriginal(x, y, pose), b = deformOriginal(x + 6, y, pose), c = deformOriginal(x, y + 5, pose), d = deformOriginal(x + 6, y + 5, pose)
    const area = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    smallestArea = Math.min(smallestArea, area(a, b, c), area(b, d, c))
  }
}
assert.ok(smallestArea > 0)
pass('6 秒仅一次眨眼；脚底固定；五官相对距离不变；起止回原位；网格不翻折', { blinkEpisodes, smallestArea })

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  const errors = [], requests = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname)
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') ? route.continue() : route.abort()
  })
  await context.addInitScript(() => {
    window.__cameraCalls = 0; window.__storageWrites = 0
    navigator.mediaDevices.getUserMedia = async () => { window.__cameraCalls++; throw new Error('Camera is outside this task') }
    Storage.prototype.setItem = () => { window.__storageWrites++; throw new Error('Storage writes are outside this task') }
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=idle')
  await page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  assert.equal(await page.locator('main').getAttribute('data-playing'), 'false')
  const canvas = page.locator('.idle-canvas'), plane = page.locator('.gentle-plane')
  const time = () => canvas.getAttribute('data-frame-time').then(Number)
  const seek = async value => {
    await page.getByRole('slider', { name: '样片进度' }).fill(String(value))
    await page.waitForFunction(value => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === value, value)
  }
  const pixels = png => sharp(png).ensureAlpha().raw().toBuffer()
  const frames = new Map()
  for (const value of [0, 1800, 2280, 2370, 2480, 3600, 6000]) {
    await seek(value)
    frames.set(value, await plane.screenshot({ path: `${output}/frame-${value}.png` }))
  }
  assert.deepEqual(await pixels(frames.get(0)), await pixels(frames.get(6000)))
  const foot = png => sharp(png).extract({ left: 0, top: 449, width: 438, height: 65 }).raw().toBuffer()
  for (const frame of frames.values()) assert.deepEqual(await foot(frame), await foot(frames.get(0)))
  assert.notDeepEqual(await pixels(frames.get(0)), await pixels(frames.get(1800)))
  pass('实际浏览器画面：起止像素一致，全部截帧脚底与阴影一致，吸气帧有局部变化')
  await page.getByRole('button', { name: '回到原位', exact: true }).click()
  await page.getByRole('button', { name: '下一帧', exact: true }).click()
  assert.ok(Math.abs(await time() - 1000 / 30) < 0.001)
  await page.getByRole('button', { name: '上一帧', exact: true }).click()
  assert.equal(await time(), 0)
  await page.getByRole('button', { name: '播放 6 秒样片', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) > 800)
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  const paused = await time(), pausedImage = await canvas.evaluate(node => node.toDataURL())
  await page.waitForTimeout(250)
  assert.equal(await time(), paused)
  assert.equal(await canvas.evaluate(node => node.toDataURL()), pausedImage)
  await page.getByRole('button', { name: '继续播放', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === 6000)
  assert.equal(await page.locator('main').getAttribute('data-playing'), 'false')
  pass('默认静止；逐帧准确；暂停冻结实际画面；正常播放 6 秒后自动停止')
  await page.getByRole('button', { name: '重新播放', exact: true }).click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) > 100)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForFunction(() => document.querySelector('main')?.dataset.playing === 'false')
  await page.evaluate(() => { delete document.hidden })
  await page.getByRole('button', { name: '同位置原图', exact: true }).click()
  assert.equal(await time(), 0)
  assert.equal(await page.locator('.gentle-reference image').getAttribute('href'), '/companion-assets/d-panda/design/D2-character-accessories.png')
  await page.getByRole('button', { name: '动画角色', exact: true }).click()
  pass('隐藏页面暂停，静止原图可同位置对照')
  await page.getByRole('button', { name: '闭眼瞬间', exact: true }).click()
  for (const [name, id] of [['深色', 'dark'], ['透明棋盘', 'checker'], ['浅色', 'paper']]) {
    await page.getByRole('button', { name, exact: true }).click()
    await plane.screenshot({ path: `${output}/closed-${id}.png` })
  }
  await page.getByRole('button', { name: '回到原位', exact: true }).click()
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.deepEqual(requests.filter(path => /\/dpanda\/|\/mirror\/|PandaStage|\.wasm$|pose_landmarker/.test(path)), [])
  assert.equal(await page.evaluate(() => window.__cameraCalls), 0)
  assert.equal(await page.evaluate(() => window.__storageWrites), 0)
  assert.deepEqual(errors, [])
  pass('深浅背景与手机宽度可查看；无脚本错误；未加载旧角色、相机或镜像；未写存储')
  await canvas.evaluate(node => node.getContext('webgl').getExtension('WEBGL_lose_context').loseContext())
  await page.getByRole('alert').filter({ hasText: '动画画面暂时中断' }).waitFor()
  assert.ok(await page.locator('.gentle-play').isDisabled())
  pass('WebGL 中断提示恢复方式并停止播放')
  await page.route('**/idle/closed-eyes-original.svg', route => route.abort())
  await page.reload()
  await page.getByRole('alert').filter({ hasText: '原画素材暂时无法加载' }).waitFor()
  assert.ok(await page.locator('.gentle-play').isDisabled())
  pass('闭眼素材失败时明确提示并阻止空白播放')
  await context.close()

  const recorded = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: 'block', recordVideo: { dir: output, size: { width: 1440, height: 1100 } } })
  await recorded.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const movie = await recorded.newPage()
  await movie.goto('http://127.0.0.1:4175/?companion-lab=1&review=gentle')
  await movie.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  assert.equal(await movie.locator('main').getAttribute('data-version'), 'D-idle-original')
  await movie.getByRole('button', { name: '播放 6 秒样片', exact: true }).click()
  await movie.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === 6000)
  await movie.waitForTimeout(500)
  const video = movie.video()
  await recorded.close()
  await video.saveAs(`${output}/idle-normal-speed.webm`)
  pass('旧 gentle 链接进入新版；已保存实际页面正常速度录像')
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2))
  throw error
} finally { await browser.close() }
