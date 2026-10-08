import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { ACTIONS, actionPose, deformAction } from '../src/companion/actionMotion.ts'

const output = `evals/virtual-companion/d-panda/actions-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const checks = [], pass = (name, data = {}) => checks.push({ name, ...data, result: 'PASS' })
const hash = buffer => createHash('sha256').update(buffer).digest('hex')
const manifest = JSON.parse(readFileSync('public/companion-assets/d-panda/actions/manifest.json', 'utf8'))
for (const selection of manifest.selections) {
  const source = readFileSync(`docs/virtual-companion-v4/panda-ip-handoff-2026-10-08/assets/${selection.file}`)
  assert.equal(hash(source), selection.sha256)
  for (const suffix of ['original', 'ground']) {
    const svg = readFileSync(`public/companion-assets/d-panda/actions/${selection.id}-${suffix}.svg`, 'utf8')
    assert.deepEqual(Buffer.from(svg.match(/href="data:image\/png;base64,([^"]+)"/)[1], 'base64'), source)
    assert.equal((svg.match(/<image /g) ?? []).length, 1)
    assert.ok(!/<filter|<text|<animate/.test(svg))
  }
}
pass('新增素材仅遮罩选择原画像素，内嵌原 PNG 与交付包字节一致')
for (const action of ACTIONS) {
  const nx = Math.ceil(action.crop[2] / 6), ny = Math.ceil(action.crop[3] / 5)
  let smallestArea = Infinity, largestStep = 0, largestFaceDistanceChange = 0
  const points = action.id === 'stretch' ? [[151, 95], [210, 168]] : action.id === 'hat' ? [[164, 162], [246, 242]] : [[170, 115], [250, 228]]
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])
  let previous = null
  for (let time = 0; time <= action.duration; time += 20) {
    const pose = actionPose(action.id, time)
    for (const x of [0, 50, 150, 300]) for (const y of [action.footY, action.crop[3]]) assert.deepEqual(deformAction(action.id, x, y, pose), [x, y])
    const face = points.map(([x, y]) => deformAction(action.id, x, y, pose))
    const distanceChange = distance(...face) / distance(...points) - 1
    largestFaceDistanceChange = Math.max(largestFaceDistanceChange, Math.abs(distanceChange))
    if (action.id === 'encourage') {
      assert.ok(distanceChange > -.06 && distanceChange < .01, 'Pitch projection must stay shallow')
      face.forEach((point, index) => assert.equal(point[0], points[index][0], 'No sideways head motion'))
      assert.equal(pose.blink, 0)
      for (const [x, y] of [[50, 320], [307, 342]]) assert.ok(Math.abs(deformAction(action.id, x, y, pose)[1] - y) < .1, 'No shrugging paws')
    } else assert.ok(Math.abs(distanceChange) < 1e-6, `${action.id}: face stretch`)
    if (previous) largestStep = Math.max(largestStep, distance(face[0], previous))
    previous = face[0]
    if (action.id === 'hat') {
      const contact = [[100, 135], [108, 134]].map(([x, y]) => deformAction(action.id, x, y, pose))
      assert.ok(Math.abs(distance(...contact) - Math.hypot(8, 1)) < 1e-9)
    }
    if (time % 100 !== 0) continue
    for (let row = 0; row < ny; row++) for (let column = 0; column < nx; column++) {
      const x = column / nx * action.crop[2], y = row / ny * action.crop[3], dx = action.crop[2] / nx, dy = action.crop[3] / ny
      const a = deformAction(action.id, x, y, pose), b = deformAction(action.id, x + dx, y, pose), c = deformAction(action.id, x, y + dy, pose), d = deformAction(action.id, x + dx, y + dy, pose)
      const area = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
      smallestArea = Math.min(smallestArea, area(a, b, c), area(b, d, c))
      if (time === 0 || time === action.duration) assert.ok(Math.hypot(a[0] - x, a[1] - y) < 1e-9)
    }
  }
  assert.ok(smallestArea > 0, `${action.id}: folded mesh`)
  assert.ok(largestStep < 3, `${action.id}: discontinuous movement`)
  pass(`${action.title}：足底固定、${action.id === 'encourage' ? '小幅俯仰且无侧移或抬爪' : '五官距离不变'}、起止复位、无网格翻折与位置跳变`, { smallestArea, largestStepPer20ms: largestStep, largestFaceDistanceChange })
}

let nodEpisodes = 0, active = false
for (let time = 0; time <= 3000; time += 5) {
  const down = actionPose('encourage', time).main > .1
  if (down && !active) nodEpisodes++
  active = down
}
assert.equal(nodEpisodes, 1, 'Encouragement contains one nod, not repeated rebounds')
pass('点头只出现一次主下点，保持睁眼，去掉第二次回弹')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' })
  const errors = [], requests = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname)
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') ? route.continue() : route.abort()
  })
  await context.addInitScript(() => {
    window.__cameraCalls = 0; window.__writes = 0
    navigator.mediaDevices.getUserMedia = async () => { window.__cameraCalls++; throw new Error('Camera not authorized') }
    Storage.prototype.setItem = () => { window.__writes++; throw new Error('Storage is outside this task') }
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=actions')
  const ready = () => page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  const seek = async time => {
    await page.getByRole('slider', { name: '样片进度' }).fill(String(time))
    await page.waitForFunction(t => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === t, time)
  }
  const raw = png => sharp(png).raw().toBuffer()
  const time = () => page.locator('.idle-canvas').getAttribute('data-frame-time').then(Number)
  for (const action of ACTIONS) {
    await page.locator(`[data-action-choice="${action.id}"]`).click(); await ready()
    assert.equal(await page.locator('.original-layout').getAttribute('data-playing'), 'false')
    const sourcePixels = await page.evaluate(async action => {
      const decode = async (url, source) => {
        const image = new Image(); image.src = url; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = action.crop[2]; canvas.height = action.crop[3]
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (source) ctx.drawImage(image, ...action.crop, 0, 0, canvas.width, canvas.height)
        else ctx.drawImage(image, 0, 0)
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data
      }
      const original = await decode('/companion-assets/d-panda/design/' + action.source, true), selected = await decode('/companion-assets/d-panda/' + action.texture, false)
      let opaque = 0, changed = 0
      for (let i = 0; i < selected.length; i += 4) if (selected[i + 3] === 255) { opaque++; if (selected[i] !== original[i] || selected[i + 1] !== original[i + 1] || selected[i + 2] !== original[i + 2]) changed++ }
      return { opaque, changed }
    }, action)
    assert.equal(sourcePixels.changed, 0); assert.ok(sourcePixels.opaque > 50000)
    const frames = []
    for (const value of [0, ...action.checkpoints.map(point => point[1]), action.duration]) {
      await seek(value)
      frames.push(await page.locator('.actions-plane').screenshot({ path: `${output}/${action.id}-${value}.png` }))
    }
    assert.deepEqual(await raw(frames[0]), await raw(frames.at(-1)))
    const footTop = Math.ceil(action.offset[1] + (action.footY + 6) * action.scale)
    const foot = png => sharp(png).extract({ left: 0, top: footTop, width: 480, height: 530 - footTop }).raw().toBuffer()
    for (const frame of frames) assert.deepEqual(await foot(frame), await foot(frames[0]))
    assert.notDeepEqual(await raw(frames[0]), await raw(frames[2]))
    await page.getByRole('button', { name: '回到原位', exact: true }).click()
    await page.getByRole('button', { name: '下一帧', exact: true }).click()
    assert.ok(Math.abs(await time() - 1000 / 30) < .01)
    await page.getByRole('button', { name: '上一帧', exact: true }).click()
    assert.equal(await time(), 0)
    await page.locator('.gentle-play').click()
    await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) > 700)
    await page.getByRole('button', { name: '暂停', exact: true }).click()
    const paused = await time(), frozen = await page.locator('.idle-canvas').evaluate(node => node.toDataURL())
    await page.waitForTimeout(200)
    assert.equal(await time(), paused); assert.equal(await page.locator('.idle-canvas').evaluate(node => node.toDataURL()), frozen)
    await page.getByRole('button', { name: '同位置原图', exact: true }).click()
    assert.equal(await time(), 0)
    assert.equal(await page.locator('.gentle-reference').getAttribute('viewBox'), action.crop.join(' '))
    await page.getByRole('button', { name: '动画角色', exact: true }).click()
    await seek(action.checkpoints[1][1])
    await page.getByRole('button', { name: '深色', exact: true }).click()
    await page.locator('.actions-plane').screenshot({ path: `${output}/${action.id}-dark.png` })
    await page.getByRole('button', { name: '浅色', exact: true }).click()
    pass(`${action.title}：原画不透明像素一致，实际起止与足底画面一致；逐帧、暂停、原图对照通过`, sourcePixels)
  }
  await page.locator('[data-action-choice="encourage"]').click(); await ready()
  await page.locator('.gentle-play').click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) > 300)
  await page.locator('[data-action-choice="hat"]').click()
  assert.equal(await page.locator('main').getAttribute('data-action'), 'encourage')
  await page.getByRole('status').filter({ hasText: '当前动作收稳后' }).waitFor()
  await page.waitForFunction(() => document.querySelector('main')?.dataset.action === 'hat')
  await ready(); assert.equal(await time(), 0)
  await page.locator('.gentle-play').click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) > 300)
  await page.locator('[data-action-choice="stretch"]').click()
  await page.getByRole('button', { name: '取消切换', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.original-layout')?.dataset.playing === 'false')
  assert.equal(await page.locator('main').getAttribute('data-action'), 'hat')
  assert.equal(await time(), 3600)
  pass('播放中切换先完成当前动作；下一段静止等待播放；可取消切换')
  await page.locator('.gentle-play').click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) > 200)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForFunction(() => document.querySelector('.original-layout')?.dataset.playing === 'false')
  await page.evaluate(() => { delete document.hidden })
  await page.getByRole('button', { name: '回到原位', exact: true }).click()
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.equal(await page.evaluate(() => window.__cameraCalls), 0); assert.equal(await page.evaluate(() => window.__writes), 0)
  assert.deepEqual(requests.filter(path => /\/dpanda\/|\/mirror\/|PandaStage|\.wasm$|pose_landmarker/.test(path)), [])
  assert.deepEqual(errors, [])
  pass('隐藏暂停；减少动态偏好下默认静止；390 宽度无溢出；无相机、存储写入、旧角色加载或脚本错误')
  await page.locator('.idle-canvas').evaluate(node => node.getContext('webgl').getExtension('WEBGL_lose_context').loseContext())
  await page.getByRole('alert').filter({ hasText: '动画画面暂时中断' }).waitFor()
  assert.ok(await page.locator('.gentle-play').isDisabled())
  await page.route('**/actions/stretch-original.svg', route => route.abort())
  await page.locator('[data-action-choice="stretch"]').click()
  await page.getByRole('alert').filter({ hasText: '原画素材暂时无法加载' }).waitFor()
  assert.ok(await page.locator('.gentle-play').isDisabled())
  pass('WebGL 中断与素材失败有提示，并阻止空白播放')
  await context.close()

  const recorded = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block', recordVideo: { dir: output, size: { width: 1440, height: 1200 } } })
  await recorded.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const movie = await recorded.newPage()
  await movie.goto('http://127.0.0.1:4175/?companion-lab=1&review=actions')
  for (const action of ACTIONS) {
    await movie.locator(`[data-action-choice="${action.id}"]`).click()
    await movie.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
    await movie.locator('.gentle-play').click()
    await movie.waitForFunction(duration => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === duration, action.duration)
    await movie.waitForTimeout(500)
  }
  const video = movie.video(); await recorded.close(); await video.saveAs(`${output}/three-actions-normal-speed.webm`)
  pass('三个动作均按正常速度播放到结束，保存实际页面录像')
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2)); throw error
} finally { await browser.close() }
