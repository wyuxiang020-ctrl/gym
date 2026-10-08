import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Only ordinary preset controls are exercised. A fresh browser profile, denied
// getUserMedia, blocked external requests and blocked APIs prevent human input.
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4175'
const origin = new URL(base).origin
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
const widths = (process.env.GYM_CARTOON_WIDTHS || '820,390').split(',').map(Number)
assert.ok(widths.every(width => Number.isFinite(width) && width >= 320))
const out = `${process.env.GYM_TEST_OUTPUT_ROOT || 'evals/virtual-companion/v4-cartoon-revision'}/browser-${Date.now()}`
const playwrightPath = process.env.GYM_PLAYWRIGHT_PATH || 'C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = await import(pathToFileURL(resolve(playwrightPath, 'index.mjs')).href)
mkdirSync(out, { recursive: true })
writeFileSync(`${out}/runner-source.mjs`, readFileSync(new URL(import.meta.url)))
const paths = ['src/companion/PandaStage.tsx', 'src/companion/pandaRig.ts', 'src/companion/CompanionLab.tsx', 'src/companion/companion.css', 'src/companion/preset.ts', 'src/companion/types.ts', 'scripts/check-companion-cartoon-v4.mjs']
const sourceHashes = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
const startedAt = new Date().toISOString()
const results = []
const browser = await chromium.launch({ headless: true, channel: process.env.GYM_BROWSER_CHANNEL || 'msedge', args: ['--enable-unsafe-swiftshader'] })
const report = () => writeFileSync(`${out}/results.json`, JSON.stringify({
  version: 'v4-cartoon-revision', startedAt, base, widths, browser: browser.version(), sourceHashes,
  evidenceType: 'Actual application Three.js WebGL preset rendering in an isolated automated desktop browser, including 390 CSS px responsive viewport. Not a real phone, design mockup, real camera or human mirror test.',
  cameraPolicy: 'Native getUserMedia replaced before page code; the suite never enables mirror or invokes physical devices.',
  cloudRequestsAllowed: false, results,
}, null, 2))
const canvas = page => page.locator('canvas[data-pose]')
const pose = async page => JSON.parse(await canvas(page).getAttribute('data-pose'))
const readRender = page => canvas(page).evaluate(element => ({ dataset: { ...element.dataset }, width: element.clientWidth, height: element.clientHeight }))

async function settled(page, predicate, explanation) {
  const deadline = Date.now() + 5000
  do {
    if (await predicate()) return
    await page.waitForTimeout(50)
  } while (Date.now() < deadline)
  assert.ok(await predicate(), explanation)
}

async function seek(page, milliseconds) {
  await page.getByRole('slider', { name: '动作进度' }).evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, milliseconds)
  await page.waitForTimeout(120)
  assert.equal(await page.locator('[data-playing]').getAttribute('data-playing'), 'false')
}

async function capture(page, row, label) {
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(80)
  const fullPage = `${out}/${row.width}-${label}-page.png`
  const stage = `${out}/${row.width}-${label}-canvas.png`
  await page.screenshot({ path: fullPage, fullPage: true })
  await canvas(page).screenshot({ path: stage })
  row.screenshots.push({ label, fullPage, canvas: stage, render: await readRender(page) })
}

try {
  for (const width of widths) {
    const row = { width, status: 'RUNNING', checks: [], screenshots: [], requests: [], blocked: [], errors: [] }
    results.push(row); report()
    const context = await browser.newContext({ viewport: { width, height: 1024 }, deviceScaleFactor: 1, timezoneId: 'Asia/Shanghai', serviceWorkers: 'block' })
    await context.addInitScript(() => {
      const audit = { cameraRequests: 0, storageWrites: [] }
      const denied = () => { audit.cameraRequests += 1; return Promise.reject(new DOMException('Preset-only software check: camera is disabled', 'NotAllowedError')) }
      if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: denied })
      else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: denied } })
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method]
        Storage.prototype[method] = function (...args) { audit.storageWrites.push({ method, key: args[0] ?? null }); return original.apply(this, args) }
      }
      window.__cartoonAudit = audit
    })
    await context.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url())
      row.requests.push({ url: url.href, method: request.method(), kind: request.resourceType() })
      if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) {
        row.blocked.push(url.href); return route.abort('blockedbyclient')
      }
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', error => row.errors.push(String(error)))
    page.setDefaultTimeout(10000)
    try {
      await page.goto(`${base}/?companion-lab=1`)
      await page.getByRole('heading', { name: '训练伙伴实验室', exact: true }).waitFor()
      await canvas(page).waitFor()
      await settled(page, async () => Number(await canvas(page).getAttribute('data-render-frame')) > 1, 'renderer has produced frames')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow')
      row.checks.push('No horizontal overflow; real WebGL canvas present')
      const rest = await pose(page)
      await capture(page, row, 'rest-front-clear')

      for (const [label, moved, still] of [['画面左手', 'right', 'left'], ['画面右手', 'left', 'right'], ['双手', 'both', null]]) {
        await page.getByRole('button', { name: label, exact: true }).click()
        await seek(page, 3500)
        const top = await pose(page)
        if (moved === 'both') {
          assert.ok(top.left.shoulder > rest.left.shoulder + 1)
          assert.ok(top.right.shoulder > rest.right.shoulder + 1)
          assert.deepEqual(top.left, top.right)
        } else {
          assert.ok(top[moved].shoulder > rest[moved].shoulder + 1)
          assert.deepEqual(top[still], rest[still])
        }
        await page.waitForTimeout(250)
        assert.deepEqual(await pose(page), top, 'paused preset remains still')
        await capture(page, row, `${moved}-raised-front-clear`)
        row.checks.push(`${label}: expected arm moves and paused pose remains fixed`)
      }

      await page.getByRole('button', { name: '画面左手', exact: true }).click()
      await seek(page, 2000)
      const held = await pose(page)
      await capture(page, row, 'same-pose-clear')
      const clear = await readRender(page)
      await page.getByRole('button', { name: '像素', exact: true }).click()
      await settled(page, async () => await canvas(page).getAttribute('data-actual-display') === 'pixel', 'pixel renderer is active')
      await capture(page, row, 'same-pose-pixel')
      const pixel = await readRender(page)
      assert.equal(clear.dataset.actualDisplay, 'clear')
      assert.deepEqual(JSON.parse(clear.dataset.pose), JSON.parse(pixel.dataset.pose))
      assert.equal(clear.width, pixel.width); assert.equal(clear.height, pixel.height)
      row.samePose = { clear, pixel }
      for (const [label, size] of [['细', '2'], ['中', '4'], ['粗', '6']]) {
        await page.getByRole('button', { name: label, exact: true }).click()
        await settled(page, async () => await canvas(page).getAttribute('data-pixel-size') === size, `pixel size ${size}`)
        assert.deepEqual(await pose(page), held)
      }
      row.checks.push('Clear and pixel use identical paused joint pose; all three pixel strengths work')
      await page.getByRole('button', { name: '清晰', exact: true }).click()
      for (const [label, view] of [['正面', 'front'], ['斜侧', 'three-quarter'], ['侧面', 'side']]) {
        await page.getByRole('button', { name: label, exact: true }).click()
        await settled(page, async () => await canvas(page).getAttribute('data-view') === view, `camera ${view}`)
        assert.deepEqual(await pose(page), held)
        await capture(page, row, `same-pose-${view}`)
      }
      row.checks.push('Front, three-quarter and side cameras preserve pose')
      await page.getByRole('button', { name: '重新开始', exact: true }).click()
      await page.waitForTimeout(100)
      assert.deepEqual(await pose(page), rest)
      await page.getByRole('button', { name: '播放动作', exact: true }).click()
      await page.waitForTimeout(1000)
      await page.getByRole('button', { name: '暂停动作', exact: true }).click()
      assert.notDeepEqual(await pose(page), rest)
      row.checks.push('Restart restores rest; playback produces continuous pose updates')
      row.audit = await page.evaluate(() => window.__cartoonAudit)
      assert.equal(row.audit.cameraRequests, 0)
      assert.deepEqual(row.audit.storageWrites, [])
      row.blockedExistingFontRequests = row.blocked.filter(url => new URL(url).hostname === 'fonts.googleapis.com')
      assert.deepEqual(row.blocked.filter(url => new URL(url).hostname !== 'fonts.googleapis.com'), [], 'no unexpected external/API requests; inherited Google Fonts stylesheet is blocked')
      assert.deepEqual(row.requests.filter(request => new URL(request.url).pathname.startsWith('/api/')), [])
      assert.deepEqual(row.requests.filter(request => /companion-assets|mediapipe|\.wasm/.test(request.url)), [])
      assert.deepEqual(row.errors, [])
      row.checks.push('No camera/model/API requests; external requests blocked; no personal-storage writes or uncaught page errors')
      row.status = 'PASS'
    } catch (error) {
      row.status = 'FAIL'; row.failure = String(error?.stack || error)
      try { await page.screenshot({ path: `${out}/${width}-failure.png`, fullPage: true }) } catch { /* Preserve original failure. */ }
    } finally { await context.close(); report() }
  }
  if (process.env.GYM_CARTOON_RECORD === '1') {
    const row = { kind: 'actual-preset-video', width: 820, status: 'RUNNING', checks: [], blocked: [] }
    results.push(row); report()
    const context = await browser.newContext({ viewport: { width: 820, height: 1024 }, deviceScaleFactor: 1, serviceWorkers: 'block', recordVideo: { dir: out, size: { width: 820, height: 1024 } } })
    await context.addInitScript(() => {
      window.__videoCameraRequests = 0
      const denied = () => { window.__videoCameraRequests += 1; return Promise.reject(new DOMException('Preset recording only', 'NotAllowedError')) }
      if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: denied })
      else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: denied } })
      document.addEventListener('DOMContentLoaded', () => {
        const label = document.createElement('div')
        label.textContent = '实际运行录像 · 预设抬手动作 · 未使用摄像头'
        Object.assign(label.style, { position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '10000', padding: '9px', textAlign: 'center', background: '#3e4837', color: 'white', font: '13px sans-serif', pointerEvents: 'none' })
        document.body.append(label)
      })
    })
    await context.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url())
      if (url.origin !== origin || url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) { row.blocked.push(url.href); return route.abort('blockedbyclient') }
      return route.continue()
    })
    const page = await context.newPage(); const video = page.video()
    try {
      await page.goto(`${base}/?companion-lab=1`); await canvas(page).waitFor()
      await page.getByRole('button', { name: '画面左手', exact: true }).click()
      await page.getByRole('button', { name: '播放动作', exact: true }).click()
      await page.waitForTimeout(8300)
      assert.equal(await page.evaluate(() => window.__videoCameraRequests), 0)
      row.checks.push('One actual 8 second local preset cycle recorded; no physical camera')
      row.status = 'PASS'
    } catch (error) { row.status = 'FAIL'; row.failure = String(error?.stack || error) }
    finally { await context.close(); row.path = `${out}/actual-preset-clear.webm`; await video.saveAs(row.path); report() }
  }
} finally { await browser.close(); report() }
console.log(JSON.stringify({ output: out, results: results.map(row => ({ width: row.width, status: row.status, checks: row.checks.length, failure: row.failure })) }, null, 2))
if (results.some(row => row.status !== 'PASS')) process.exitCode = 1
