import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const base = 'http://127.0.0.1:4175'
const width = Number(process.env.GYM_LIVELY_WIDTH || 820)
const record = process.env.GYM_LIVELY_RECORD === '1'
const out = `evals/virtual-companion/v4-illustrated/browser-${width}-${Date.now()}`
mkdirSync(out, { recursive: true })
writeFileSync(`${out}/runner.mjs`, readFileSync(new URL(import.meta.url)))
const { chromium } = await import(pathToFileURL(resolve('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--enable-unsafe-swiftshader'] })
const report = { at: new Date().toISOString(), version: 'V4.3', width, browser: browser.version(), checks: [], errors: [], blocked: [], requests: [], source: {}, kind: 'isolated desktop browser and actual Canvas 2D animation; no camera or human tracking', result: 'RUNNING' }
for (const path of ['illustratedPanda.ts', 'PandaStage.tsx', 'CompanionLab.tsx', 'characterMotion.ts', 'types.ts', 'companion.css']) report.source[path] = createHash('sha256').update(readFileSync(`src/companion/${path}`)).digest('hex')
const save = () => writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2))
save()
const context = await browser.newContext({ viewport: { width, height: 1024 }, deviceScaleFactor: 1, serviceWorkers: 'block', ...(record ? { recordVideo: { dir: out, size: { width, height: 1024 } } } : {}) })
await context.addInitScript(() => {
  window.__livelyAudit = { camera: 0, writes: [] }
  const denied = () => { window.__livelyAudit.camera++; return Promise.reject(new DOMException('Camera disabled by software test', 'NotAllowedError')) }
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: denied })
  else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: denied } })
  for (const method of ['setItem', 'removeItem', 'clear']) {
    const original = Storage.prototype[method]
    Storage.prototype[method] = function (...args) { window.__livelyAudit.writes.push(method); return original.apply(this, args) }
  }
})
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url())
  report.requests.push({ url: url.href, method: request.method() })
  if (url.origin !== base || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { report.blocked.push(url.href); return route.abort() }
  return route.continue()
})
const page = await context.newPage(), video = page.video()
page.on('pageerror', error => report.errors.push(String(error)))
const canvas = page.locator('canvas[data-pose]')
const state = () => canvas.evaluate(el => ({ pose: el.dataset.pose, motion: el.dataset.characterMotion, display: el.dataset.actualDisplay, frame: el.dataset.renderFrame }))
const seek = async value => {
  await page.getByRole('slider', { name: '动作进度' }).evaluate((input, time) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(time))
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await page.waitForTimeout(180)
}
const shot = async name => { await canvas.screenshot({ path: `${out}/${name}.png` }); save() }
try {
  await page.goto(`${base}/?companion-lab=1`); await canvas.waitFor()
  await page.getByText('手绘功夫熊猫 · V4.3', { exact: true }).count().then(count => assert.equal(count, 1))
  await page.waitForTimeout(350)
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'true')
  const idleBefore = await state(); await page.waitForTimeout(400); const idleAfter = await state()
  assert.notEqual(idleBefore.motion, idleAfter.motion)
  report.checks.push('Idle begins automatically and secondary motion changes; no camera')
  await page.getByRole('button', { name: '抱拳行礼', exact: true }).click(); await page.waitForTimeout(70)
  await page.getByRole('button', { name: '暂停动作', exact: true }).click(); await page.waitForTimeout(60)
  const transitionHeld = await state(); await page.waitForTimeout(400)
  const transitionStill = await state()
  assert.equal(transitionHeld.pose, transitionStill.pose); assert.equal(transitionHeld.motion, transitionStill.motion)
  report.checks.push('Pausing during an action transition freezes the full blend')
  for (const [action, label, at] of [['idle', '蓄势待发', 1000], ['wave', '俏皮招手', 2500], ['fold', '抱拳行礼', 3000], ['hop', '腾空踢腿', 1550], ['shuffle', '灵活小碎步', 2300], ['stretch', '伸个懒腰', 3000]]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await seek(at)
    assert.equal(await page.locator('[data-action]').getAttribute('data-action'), action)
    const held = await state(); await page.waitForTimeout(200); const still = await state()
    assert.equal(held.pose, still.pose); assert.equal(held.motion, still.motion)
    await shot(`${action}-clear`)
    report.checks.push(`${action}: selected and full character pose freezes on seek`)
    if (action === 'wave') {
      await page.getByRole('button', { name: '像素', exact: true }).click(); await page.waitForTimeout(180)
      const pixel = await state(); assert.equal(pixel.display, 'pixel'); assert.equal(pixel.pose, held.pose); assert.equal(pixel.motion, held.motion)
      await shot('wave-pixel')
      await page.getByRole('button', { name: '清晰', exact: true }).click()
      report.checks.push('Clear/pixel share the entire arm/body/head/face state')
    }
  }
  await page.getByRole('button', { name: '抱拳行礼', exact: true }).click(); await seek(3000)
  for (const [label, file] of [['朝左', 'fold-quarter'], ['朝右', 'fold-side']]) { await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(150); await shot(file) }
  await page.getByRole('button', { name: '正面', exact: true }).click()
  await page.screenshot({ path: `${out}/full-page.png`, fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  report.checks.push('Three drawn orientations and responsive layout')
  const beforeHat = await state()
  await page.getByRole('checkbox', { name: '戴上小斗笠' }).uncheck(); await page.waitForTimeout(120)
  assert.equal(await canvas.getAttribute('data-hat'), 'false')
  assert.equal((await state()).motion, beforeHat.motion)
  await shot('no-hat-front')
  await page.getByRole('button', { name: '朝左', exact: true }).click(); await page.waitForTimeout(120); await shot('no-hat-quarter')
  await page.getByRole('checkbox', { name: '戴上小斗笠' }).check()
  report.checks.push('Hat toggles without changing paused pose; front and quarter artwork render')
  await page.getByRole('checkbox', { name: '循环播放' }).uncheck()
  await seek(7900); await page.getByRole('button', { name: '播放动作', exact: true }).click(); await page.waitForTimeout(350)
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'false')
  await page.getByRole('checkbox', { name: '循环播放' }).check()
  await seek(7900); await page.getByRole('button', { name: '播放动作', exact: true }).click(); await page.waitForTimeout(350)
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'true')
  assert.ok(Number(await page.getByRole('slider', { name: '动作进度' }).inputValue()) < 1500)
  report.checks.push('Non-loop playback stops; loop playback wraps')
  await page.getByRole('button', { name: '跟随我的抬手', exact: false }).click(); await page.waitForTimeout(250)
  assert.equal((await state()).motion, '{}')
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'false')
  report.checks.push('Entering mirror clears all preset secondary motion without opening camera')
  assert.equal(await canvas.getAttribute('data-view'), 'front')
  assert.equal(await page.getByRole('button', { name: '朝右', exact: true }).isDisabled(), true)
  report.checks.push('Mirror locks the front orientation to preserve left/right mapping')
  await page.getByRole('button', { name: '预设动作实验', exact: false }).click()
  if (record) {
    await page.evaluate(() => {
      const label = document.createElement('div'); label.textContent = 'V4.3 实际预设动画 · 未使用摄像头'
      Object.assign(label.style, { position: 'fixed', bottom: '0', left: '0', right: '0', padding: '10px', background: '#344a3b', color: 'white', textAlign: 'center', zIndex: '10000' }); document.body.append(label)
    })
    for (const label of ['俏皮招手', '腾空踢腿', '抱拳行礼', '灵活小碎步']) { await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(4400) }
    report.checks.push('Actual animated sequence captured; no human video')
  }
  report.audit = await page.evaluate(() => window.__livelyAudit)
  assert.equal(report.audit.camera, 0); assert.deepEqual(report.audit.writes, []); assert.deepEqual(report.errors, [])
  assert.deepEqual(report.requests.filter(r => /companion-assets|mediapipe|\.wasm|\/api\//.test(r.url)), [])
  report.checks.push('No native camera, model, API, storage write, or page exception')
  const reduced = await browser.newContext({ viewport: { width, height: 1024 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await reduced.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  const reducedPage = await reduced.newPage()
  await reducedPage.goto(`${base}/?companion-lab=1`)
  await reducedPage.locator('canvas[data-character-motion]').waitFor()
  await reducedPage.waitForTimeout(300)
  assert.equal(await reducedPage.locator('[data-playing]').getAttribute('data-playing'), 'false')
  const reducedPose = await reducedPage.locator('canvas').getAttribute('data-character-motion')
  await reducedPage.waitForTimeout(250)
  assert.equal(await reducedPage.locator('canvas').getAttribute('data-character-motion'), reducedPose)
  await reduced.close()
  report.checks.push('Reduced-motion preference suppresses automatic idle animation')
  await page.getByRole('button', { name: '俏皮招手', exact: true }).click()
  await canvas.evaluate(el => el.dispatchEvent(new Event('contextlost', { cancelable: true })))
  await page.getByRole('button', { name: '重新加载角色', exact: true }).waitFor()
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'false')
  await page.getByRole('button', { name: '重新加载角色', exact: true }).click(); await canvas.waitFor()
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'false')
  assert.equal(await page.evaluate(() => window.__livelyAudit.camera), 0)
  report.checks.push('Canvas context loss stops playback and can recover without auto-starting camera')
  report.result = 'PASS'
} catch (error) { report.result = 'FAIL'; report.failure = String(error.stack || error); await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {}) }
finally { await context.close(); if (record) { report.video = `${out}/actual-performance.webm`; await video.saveAs(report.video) } await browser.close(); save() }
console.log(JSON.stringify({ out, result: report.result, checks: report.checks.length, failure: report.failure }))
if (report.result !== 'PASS') process.exitCode = 1
