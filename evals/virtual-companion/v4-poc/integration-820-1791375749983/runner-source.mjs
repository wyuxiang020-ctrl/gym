import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Isolated browser profiles only. getUserMedia is replaced before application
// code executes: this suite never requests a real camera or microphone.
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4175'
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Only a loopback test service is permitted')
const width = Number(process.env.GYM_VIEWPORT_WIDTH || 820)
const out = `${process.env.GYM_TEST_OUTPUT_ROOT || 'evals/virtual-companion/v4-poc'}/integration-${width}-${Date.now()}`
const playwrightPath = process.env.GYM_PLAYWRIGHT_PATH || 'C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = await import(pathToFileURL(resolve(playwrightPath, 'index.mjs')).href)
mkdirSync(out, { recursive: true })
const sourcePaths = [
  'src/main.tsx', 'src/EntryRouter.tsx', 'src/EntryBoundary.tsx', 'src/App.tsx',
  'src/companion/CompanionLab.tsx', 'src/companion/companion.css', 'src/companion/preset.ts', 'src/companion/PandaStage.tsx',
  'src/companion/pandaRig.ts', 'src/companion/mirror/MirrorSession.ts',
  'src/companion/mirror/mapping.ts', 'public/companion-assets/pose-worker.js',
  'vite.config.ts', 'scripts/check-companion-integration-v4.mjs',
]
writeFileSync(`${out}/runner-source.mjs`, readFileSync(new URL(import.meta.url)))
const sourceHashes = Object.fromEntries(sourcePaths.filter(existsSync).map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
const startedAt = new Date().toISOString()
const results = []
const browser = await chromium.launch({ headless: true, channel: process.env.GYM_BROWSER_CHANNEL || 'msedge', args: ['--enable-unsafe-swiftshader'] })

function persist() {
  writeFileSync(`${out}/results.json`, JSON.stringify({
    version: 'virtual-companion-v4-poc', startedAt, base, viewport: { width, height: 1024, deviceScaleFactor: 1 },
    browser: browser.version(), channel: process.env.GYM_BROWSER_CHANNEL || 'msedge',
    browserArguments: ['--enable-unsafe-swiftshader'],
    evidenceType: 'isolated automated browser software checks; generated blank canvas streams and injected failures; real local worker only receives blank synthetic images; NO real camera, human tracking, mobile device or cloud model evidence',
    cloudModelCalls: 0, cloudModelCostUsd: 0, infrastructureCostUsd: null,
    cameraPolicy: 'original getUserMedia is never invoked; only deterministic rejection or generated blank canvas captureStream',
    sourceHashes, results,
  }, null, 2))
}

function installSoftwareFixtures(options) {
  const originalGet = Storage.prototype.getItem
  const originalSet = Storage.prototype.setItem
  const originalRemove = Storage.prototype.removeItem
  const originalClear = Storage.prototype.clear
  if (options.sentinel) {
    originalSet.call(localStorage, 'gym-data-v1', 'V4 SOFTWARE SENTINEL: deliberately not a body profile')
    originalSet.call(sessionStorage, 'gym-workout-draft-v3:2026-10-07', 'V4 SOFTWARE DRAFT SENTINEL')
  }
  const audit = { reads: [], writes: [], gum: [], streams: [], workers: [], deferredMedia: [], framePosts: 0, originalCameraCalls: 0 }
  const storageName = storage => storage === localStorage ? 'localStorage' : 'sessionStorage'
  Storage.prototype.getItem = function (key) { audit.reads.push({ storage: storageName(this), key }); return originalGet.call(this, key) }
  Storage.prototype.setItem = function (key, value) { audit.writes.push({ storage: storageName(this), key, operation: 'set' }); return originalSet.call(this, key, value) }
  Storage.prototype.removeItem = function (key) { audit.writes.push({ storage: storageName(this), key, operation: 'remove' }); return originalRemove.call(this, key) }
  Storage.prototype.clear = function () { audit.writes.push({ storage: storageName(this), operation: 'clear' }); return originalClear.call(this) }
  const contents = storage => Object.fromEntries(Array.from({ length: storage.length }, (_, index) => storage.key(index)).sort().map(key => [key, originalGet.call(storage, key)]))
  const makeStream = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 240
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#6b7280'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    const stream = canvas.captureStream(15)
    const row = { stream, createdAt: performance.now(), stoppedAt: null, stopCalls: 0 }
    const interval = setInterval(() => { ctx.fillStyle = '#6b7280'; ctx.fillRect(0, 0, 320, 240) }, 60)
    for (const track of stream.getTracks()) {
      const originalStop = track.stop.bind(track)
      track.stop = () => { row.stopCalls += 1; row.stoppedAt = performance.now(); clearInterval(interval); originalStop() }
    }
    audit.streams.push(row)
    return stream
  }
  const getUserMedia = constraints => {
    audit.gum.push({ constraints, at: performance.now() })
    if (options.media === 'fake') return Promise.resolve(makeStream())
    if (options.media === 'deferred') return new Promise(resolve => audit.deferredMedia.push(() => resolve(makeStream())))
    return Promise.reject(new DOMException('Injected software test; no physical device accessed', options.media === 'missing' ? 'NotFoundError' : 'NotAllowedError'))
  }
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: getUserMedia, configurable: true })
  else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  if (options.worker) {
    window.Worker = class SoftwareWorker {
      constructor(url) { this.url = String(url); this.onmessage = null; this.onerror = null; this.listeners = new Map(); this.terminated = false; this.posts = []; audit.workers.push(this) }
      set onmessage(handler) { this.currentHandler = handler; if (handler) this.lastHandler = handler }
      get onmessage() { return this.currentHandler }
      addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener) }
      removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener) }
      dispatch(data) { const event = { data }; this.onmessage?.(event); for (const listener of this.listeners.get('message') || []) listener(event) }
      postMessage(message) {
        this.posts.push({ type: message.type, id: message.id, at: performance.now() })
        if (message.type === 'init') {
          if (options.worker === 'init-error') setTimeout(() => this.dispatch({ type: 'error', stage: 'init', message: 'Injected initialization failure' }), 0)
          else if (options.worker !== 'deferred-ready') setTimeout(() => this.dispatch({ type: 'ready', resourceLoadMs: 0, initializationMs: 0 }), 0)
        }
        if (message.type === 'frame') {
          audit.framePosts += 1; message.bitmap.close()
          this.lastResult = { type: 'result', id: message.id, capturedAt: message.capturedAt, width: message.width, height: message.height, landmarks: [], inferenceMs: 0 }
          if (options.worker !== 'deferred-result') setTimeout(() => this.dispatch(this.lastResult), 0)
        }
      }
      terminate() { this.terminated = true }
    }
  }
  window.__companionSoftwareTest = {
    snapshot: () => ({
      localStorage: contents(localStorage), sessionStorage: contents(sessionStorage), reads: [...audit.reads], writes: [...audit.writes],
      gum: [...audit.gum], activeTracks: audit.streams.reduce((sum, row) => sum + row.stream.getTracks().filter(track => track.readyState === 'live').length, 0),
      streams: audit.streams.map(({ createdAt, stoppedAt, stopCalls }) => ({ createdAt, stoppedAt, stopCalls })),
      workers: audit.workers.map(worker => ({ url: worker.url, terminated: worker.terminated, posts: worker.posts })),
      activeWorkers: audit.workers.filter(worker => !worker.terminated).length, framePosts: audit.framePosts, originalCameraCalls: audit.originalCameraCalls,
    }),
    resolveMedia: () => { for (const resolve of audit.deferredMedia.splice(0)) resolve(); return performance.now() },
    // Deliberately invoke a queued old callback even after terminate/null-handler.
    emitLateReady: () => audit.workers.forEach(worker => worker.lastHandler?.({ data: { type: 'ready', resourceLoadMs: 0, initializationMs: 0 } })),
    emitLateResult: () => audit.workers.forEach(worker => worker.lastResult && worker.lastHandler?.({ data: worker.lastResult })),
    setHidden: hidden => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      return performance.now()
    },
  }
  if (options.recordVideo) document.addEventListener('DOMContentLoaded', () => {
    const label = document.createElement('div')
    label.textContent = '实际三维预设运行 · 自动化操作 · 非人体镜像'
    Object.assign(label.style, { position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '10000', padding: '8px', textAlign: 'center', background: '#233d30', color: 'white', font: '13px sans-serif', pointerEvents: 'none' })
    document.body.append(label)
  })
}

const canvasFor = page => page.locator('canvas[data-pose]')
const snapshot = page => page.evaluate(() => window.__companionSoftwareTest.snapshot())
const storageOnly = value => ({ localStorage: value.localStorage, sessionStorage: value.sessionStorage })
const pose = page => canvasFor(page).getAttribute('data-pose').then(JSON.parse)
const mirrorState = page => page.locator('[data-mirror-state]').getAttribute('data-mirror-state')
const companionResource = pathname => /companion|mediapipe|pose[-_]|\.wasm$|\/three[^/]*[./-]/i.test(pathname)
const poseResource = pathname => /companion-assets|mediapipe|pose[-_]|\.wasm$/i.test(pathname)
async function waitFor(page, read, predicate, message, ms = 8000) {
  const until = Date.now() + ms
  let value
  do { value = await read(); if (predicate(value)) return value; await page.waitForTimeout(40) } while (Date.now() < until)
  assert.ok(predicate(value), `${message}; actual=${JSON.stringify(value)}`)
}
async function openLab(page) {
  await page.goto(`${base}/?companion-lab=1`)
  await page.getByRole('heading', { name: '训练伙伴实验室', exact: true }).waitFor()
  await canvasFor(page).waitFor()
}
async function openMirror(page) { await page.getByRole('button', { name: /跟随我的抬手$/ }).click() }
async function startMirror(page) { await openMirror(page); await page.getByRole('button', { name: '开启摄像头', exact: true }).click() }
async function pausePreset(page) {
  const button = page.getByRole('button', { name: '暂停动作', exact: true })
  if (await button.count()) await button.click()
}
async function settledStopped(page) {
  return waitFor(page, () => snapshot(page), state => state.activeTracks === 0 && state.activeWorkers === 0, 'all generated tracks and fake workers released within 1 second', 1000)
}

async function scenario(id, name, options, run) {
  if (process.env.GYM_CASE_FILTER && !process.env.GYM_CASE_FILTER.split(',').some(prefix => id.startsWith(prefix.trim()))) return
  const context = await browser.newContext({ viewport: { width, height: 1024 }, deviceScaleFactor: 1, timezoneId: 'Asia/Shanghai', serviceWorkers: options.allowServiceWorker ? 'allow' : 'block', ...(options.recordVideo ? { recordVideo: { dir: out, size: { width, height: 1024 } } } : {}) })
  await context.addInitScript(installSoftwareFixtures, options)
  const requests = []; const blocked = []; const apiAttempts = []; const errors = []; const assetResponses = []; const responseTasks = []
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), kind: request.resourceType() }))
  if (options.noRoutes) context.on('response', response => {
    if (!new URL(response.url()).pathname.startsWith('/companion-assets/')) return
    responseTasks.push((async () => {
      const headers = await response.allHeaders(); const requestHeaders = await response.request().allHeaders()
      assetResponses.push({ url: response.url(), status: response.status(), fromServiceWorker: response.fromServiceWorker(), headers: Object.fromEntries(['cache-control', 'etag', 'last-modified', 'content-length', 'age'].filter(key => headers[key] !== undefined).map(key => [key, headers[key]])), conditionalRequest: Object.fromEntries(['if-none-match', 'if-modified-since'].filter(key => requestHeaders[key] !== undefined).map(key => [key, requestHeaders[key]])) })
    })())
  })
  if (!options.noRoutes) await context.route('**/*', route => {
    const request = route.request(); const url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) { apiAttempts.push(url.href); return route.abort('blockedbyclient') }
    if (url.origin !== new URL(base).origin) { blocked.push(url.href); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { blocked.push(url.href); return route.abort('blockedbyclient') }
    if (options.abortBundle && url.pathname.endsWith('/vision_bundle.js')) return route.abort('failed')
    return route.continue()
  })
  const page = await context.newPage(); page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  const row = { id, name, evidenceType: options.evidenceType || 'automated software with synthetic fixtures', attempt: 1, at: new Date().toISOString(), pass: false }
  const start = Date.now()
  try {
    await run(page, row, requests)
    const audit = await snapshot(page)
    assert.equal(audit.originalCameraCalls, 0)
    assert.deepEqual(apiAttempts, [], 'no existing cloud API may be requested')
    assert.deepEqual(errors, [], 'no uncaught page errors')
    if (options.noRoutes) assert.deepEqual(requests.filter(request => new URL(request.url).origin !== new URL(base).origin || new URL(request.url).pathname.startsWith('/api/')), [], 'cache-only harness must request only same-origin static assets')
    row.audit = audit; row.pass = true
  } catch (error) { row.error = error.stack || error.message; row.audit = await snapshot(page).catch(() => null) }
  await Promise.all(responseTasks)
  row.ms = Date.now() - start; row.requests = requests; row.blockedExternalRequests = blocked; row.apiAttempts = apiAttempts; row.pageErrors = errors
  if (options.noRoutes) row.assetResponses = assetResponses
  row.screenshot = `${out}/${id}.png`
  await page.screenshot({ path: row.screenshot, fullPage: true }).catch(error => { row.screenshotError = error.message })
  results.push(row); persist()
  const recording = options.recordVideo ? page.video() : null
  await context.close()
  if (recording) { row.recording = await recording.path(); persist() }
  console.log(JSON.stringify({ id, name, pass: row.pass, ms: row.ms, error: row.error }))
}

try {
  await scenario('I01', 'Ordinary entry does not fetch companion, pose, WASM or Three resources', { allowServiceWorker: true }, async (page, row, requests) => {
    await page.goto(base); await page.waitForTimeout(1800)
    const unexpected = requests.filter(request => companionResource(new URL(request.url).pathname))
    assert.deepEqual(unexpected, [])
    assert.equal((await snapshot(page)).gum.length, 0)
    row.serviceWorkers = await page.evaluate(async () => navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(registration => registration.active?.scriptURL) : [])
    const buildDir = process.env.GYM_TEST_BUILD_DIR
    if (buildDir) {
      const path = resolve(buildDir, 'sw.js')
      assert.ok(existsSync(path), 'isolated production build sw.js exists')
      const source = readFileSync(path, 'utf8')
      const precached = [...source.matchAll(/url\s*:\s*["']([^"']+)["']/g)].map(match => match[1])
      assert.ok(precached.length > 0, 'production precache manifest was inspected')
      assert.deepEqual(precached.filter(companionResource), [])
      row.precache = { path, sha256: createHash('sha256').update(source).digest('hex'), urls: precached }
    } else row.precache = { status: 'NOT_RUN', reason: 'GYM_TEST_BUILD_DIR was not supplied; dev network evidence does not establish production precache behavior' }
  })

  await scenario('I02', 'Blank-profile experiment requests no camera/model and writes no training data', {}, async (page, row, requests) => {
    await openLab(page); await page.waitForTimeout(600)
    const audit = await snapshot(page)
    assert.deepEqual(storageOnly(audit), { localStorage: {}, sessionStorage: {} })
    assert.deepEqual(audit.writes, []); assert.equal(audit.gum.length, 0)
    assert.deepEqual(audit.reads.filter(read => read.key === 'gym-data-v1'), [], 'AppContent profile store is not read')
    assert.deepEqual(requests.filter(request => poseResource(new URL(request.url).pathname)), [])
    row.render = await canvasFor(page).evaluate(canvas => ({ dataset: { ...canvas.dataset }, width: canvas.clientWidth, height: canvas.clientHeight }))
  })

  await scenario('I03', 'Preset pause, same-pose clear/pixel and three view comparison preserve storage', { sentinel: true }, async (page, row) => {
    await openLab(page); const before = storageOnly(await snapshot(page))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal document overflow at this viewport width')
    await page.getByRole('button', { name: '画面左手', exact: true }).click()
    if (await page.getByRole('button', { name: '播放动作', exact: true }).count()) await page.getByRole('button', { name: '播放动作', exact: true }).click()
    await page.waitForTimeout(1100); await pausePreset(page); await page.waitForTimeout(80)
    const held = await pose(page)
    await page.waitForTimeout(250); assert.deepEqual(await pose(page), held, 'pause freezes local joint pose')
    row.pausedPose = held
    await page.getByRole('button', { name: '清晰', exact: true }).click(); await page.waitForTimeout(100)
    const clear = await canvasFor(page).evaluate(canvas => ({ dataset: { ...canvas.dataset }, rect: { width: canvas.clientWidth, height: canvas.clientHeight } }))
    await page.screenshot({ path: `${out}/I03-clear-same-pose.png`, fullPage: true })
    await page.getByRole('button', { name: '像素', exact: true }).click(); await page.waitForTimeout(100)
    const pixel = await canvasFor(page).evaluate(canvas => ({ dataset: { ...canvas.dataset }, rect: { width: canvas.clientWidth, height: canvas.clientHeight } }))
    assert.equal(clear.dataset.actualDisplay, 'clear'); assert.equal(pixel.dataset.actualDisplay, 'pixel')
    assert.deepEqual(JSON.parse(clear.dataset.pose), JSON.parse(pixel.dataset.pose)); assert.equal(clear.dataset.view, pixel.dataset.view); assert.deepEqual(clear.rect, pixel.rect)
    await page.screenshot({ path: `${out}/I03-pixel-same-pose.png`, fullPage: true })
    row.samePoseComparison = { clear, pixel, evidenceType: 'actual continuous Three rendering of a preset, not a design image' }
    for (const [label, size] of [['细', '2'], ['中', '4'], ['粗', '6']]) {
      await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(70)
      assert.equal(await canvasFor(page).getAttribute('data-pixel-size'), size)
      assert.deepEqual(await pose(page), held)
    }
    await page.getByRole('button', { name: '清晰', exact: true }).click()
    for (const [label, view] of [['正面', 'front'], ['斜侧', 'three-quarter'], ['侧面', 'side']]) {
      await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(100)
      assert.equal(await canvasFor(page).getAttribute('data-view'), view)
      assert.deepEqual(await pose(page), held)
      await page.screenshot({ path: `${out}/I03-${view}.png`, fullPage: true })
    }
    for (const label of ['画面右手', '双手']) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.getByRole('button', { name: '重新开始', exact: true }).click()
      if (await page.getByRole('button', { name: '播放动作', exact: true }).count()) await page.getByRole('button', { name: '播放动作', exact: true }).click()
      const startPose = await pose(page); await page.waitForTimeout(label === '双手' ? 3650 : 1100); await pausePreset(page)
      assert.notDeepEqual(await pose(page), startPose, `${label} changes joint pose during preset playback`)
      if (label === '双手') {
        row.topPose = await pose(page)
        await page.screenshot({ path: `${out}/I03-top-side.png`, fullPage: true })
        await page.getByRole('button', { name: '正面', exact: true }).click(); await page.waitForTimeout(80)
        await page.screenshot({ path: `${out}/I03-top-front.png`, fullPage: true })
        await page.getByRole('button', { name: '重新开始', exact: true }).click(); await page.waitForTimeout(80)
        row.restartedPose = await pose(page)
        assert.notDeepEqual(row.restartedPose, row.topPose)
        await page.screenshot({ path: `${out}/I03-rest-front.png`, fullPage: true })
      }
    }
    assert.deepEqual(storageOnly(await snapshot(page)), before); assert.deepEqual((await snapshot(page)).writes, [])
  })

  for (const [id, media, label] of [['I04', 'denied', 'permission rejected'], ['I05', 'missing', 'camera absent']]) {
    await scenario(id, `Injected ${label} is recoverable and never downloads a model`, { media, sentinel: true }, async (page, row, requests) => {
      await openLab(page); const before = storageOnly(await snapshot(page)); await openMirror(page)
      const startButton = page.getByRole('button', { name: '开启摄像头', exact: true })
      await startButton.scrollIntoViewIfNeeded()
      row.cameraControlBounds = await startButton.boundingBox()
      assert.ok(row.cameraControlBounds.x >= 0 && row.cameraControlBounds.x + row.cameraControlBounds.width <= width + 1, 'camera control fits this viewport')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mirror has no horizontal overflow')
      assert.equal((await snapshot(page)).gum.length, 0, 'entering mirror alone is not camera consent')
      await page.getByRole('button', { name: '开启摄像头', exact: true }).click()
      await waitFor(page, () => mirrorState(page), state => state === 'error', 'camera error state')
      const audit = await snapshot(page); assert.equal(audit.gum.length, 1); assert.equal(audit.gum[0].constraints.audio, false)
      assert.equal(audit.activeTracks, 0); assert.deepEqual(storageOnly(audit), before)
      assert.deepEqual(requests.filter(request => poseResource(new URL(request.url).pathname)), [])
      await page.screenshot({ path: `${out}/${id}-camera-error.png`, fullPage: true })
      await page.getByRole('button', { name: /预设动作实验$/ }).click(); assert.equal(await canvasFor(page).count(), 1)
    })
  }

  await scenario('I06', 'Late generated stream after switching to preset is stopped within one second', { media: 'deferred', worker: 'ready', sentinel: true }, async (page, row) => {
    await openLab(page); const before = storageOnly(await snapshot(page)); await startMirror(page)
    await waitFor(page, () => snapshot(page), state => state.gum.length === 1, 'pending camera request')
    await page.getByRole('button', { name: /预设动作实验$/ }).click()
    const resolvedAt = await page.evaluate(() => window.__companionSoftwareTest.resolveMedia())
    const audit = await waitFor(page, () => snapshot(page), state => state.streams.length === 1 && state.activeTracks === 0, 'late generated stream stopped', 1000)
    assert.ok(audit.streams[0].stoppedAt - resolvedAt <= 1000)
    assert.equal(audit.workers.length, 0); assert.deepEqual(storageOnly(audit), before)
    row.releaseLatencyMs = audit.streams[0].stoppedAt - resolvedAt
  })

  await scenario('I07', 'Injected page hiding releases stream and worker; showing requires a fresh click', { media: 'fake', worker: 'ready', sentinel: true }, async (page, row) => {
    await openLab(page); const before = storageOnly(await snapshot(page)); await startMirror(page)
    await waitFor(page, () => snapshot(page), state => state.framePosts > 0, 'fake worker received blank generated frames')
    const hiddenAt = await page.evaluate(() => window.__companionSoftwareTest.setHidden(true))
    const stopped = await settledStopped(page); const framesAtStop = stopped.framePosts
    assert.ok(stopped.streams.every(stream => stream.stoppedAt - hiddenAt <= 1000))
    await page.waitForTimeout(1100); assert.equal((await snapshot(page)).framePosts, framesAtStop)
    await page.evaluate(() => window.__companionSoftwareTest.setHidden(false)); await page.waitForTimeout(400)
    const shown = await snapshot(page); assert.equal(shown.gum.length, 1); assert.equal(shown.activeTracks, 0); assert.deepEqual(storageOnly(shown), before)
    row.hiddenEvent = 'software-injected document visibility change; not an operating-system backgrounding test'
    row.releaseLatencyMs = stopped.streams.map(stream => stream.stoppedAt - hiddenAt)
  })

  for (const [id, worker, event] of [['I08', 'deferred-ready', 'emitLateReady'], ['I09', 'deferred-result', 'emitLateResult']]) {
    await scenario(id, `${worker}: stop ignores late worker messages and releases resources`, { media: 'fake', worker }, async (page, row) => {
      await openLab(page); await startMirror(page)
      await waitFor(page, () => snapshot(page), state => worker === 'deferred-result' ? state.framePosts > 0 : state.workers.length > 0, 'test worker reached pending stage')
      await page.getByRole('button', { name: '停止摄像头', exact: true }).click(); const stopped = await settledStopped(page)
      await page.evaluate(name => window.__companionSoftwareTest[name](), event); await page.waitForTimeout(400)
      const after = await snapshot(page)
      assert.equal(after.activeTracks, 0); assert.equal(after.activeWorkers, 0); assert.equal(after.framePosts, stopped.framePosts)
      assert.notEqual(await mirrorState(page), 'tracking'); row.lateMessage = event
    })
  }

  await scenario('I10', 'Injected model initialization failure stops generated camera and permits preset recovery', { media: 'fake', worker: 'init-error', sentinel: true }, async page => {
    await openLab(page); const before = storageOnly(await snapshot(page)); await startMirror(page)
    await waitFor(page, () => mirrorState(page), state => state === 'error', 'model initialization error state')
    await settledStopped(page)
    await page.getByRole('button', { name: /预设动作实验$/ }).click()
    assert.deepEqual(storageOnly(await snapshot(page)), before)
  })

  await scenario('I11', 'Three generated-stream mirror/preset cycles do not retain workers or infer in preset', { media: 'fake', worker: 'ready' }, async (page, row) => {
    await openLab(page)
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await startMirror(page)
      await waitFor(page, () => snapshot(page), state => state.workers.length === cycle + 1 && state.framePosts > cycle, 'new fake worker reached frame loop')
      await page.getByRole('button', { name: /预设动作实验$/ }).click()
      const stopped = await settledStopped(page); await page.waitForTimeout(150)
      assert.equal((await snapshot(page)).framePosts, stopped.framePosts)
    }
    const audit = await snapshot(page); assert.equal(audit.gum.length, 3); assert.equal(audit.workers.length, 3); assert.equal(audit.activeTracks, 0); assert.equal(audit.activeWorkers, 0)
    row.cycles = 3
  })

  await scenario('I12', 'Actual WebGL context-loss event stops generated stream; renderer can recover without reopening camera', { media: 'fake', worker: 'ready' }, async (page, row) => {
    await openLab(page); await startMirror(page)
    await waitFor(page, () => snapshot(page), state => state.framePosts > 0, 'generated stream is active')
    const hasExtension = await canvasFor(page).evaluate(canvas => {
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
      if (!extension) return false
      extension.loseContext(); return true
    })
    assert.equal(hasExtension, true, 'renderer supports deliberate context-loss injection')
    await page.getByRole('alert').waitFor(); await settledStopped(page)
    await page.getByRole('button', { name: '重新加载角色', exact: true }).click(); await canvasFor(page).waitFor()
    const audit = await snapshot(page); assert.equal(audit.gum.length, 1); assert.equal(audit.activeTracks, 0)
    row.failureType = 'software-triggered WEBGL_lose_context, not an observed spontaneous GPU failure'
  })

  await scenario('W01', 'Real local worker initializes official model and returns no pose for blank synthetic images', { evidenceType: 'real local worker/model execution on generated blank images; NOT camera/human mirror validation' }, async (page, row) => {
    await openLab(page)
    row.worker = await page.evaluate(async () => {
      const worker = new Worker('/companion-assets/pose-worker.js')
      const inbox = new Map(); let waiting = null
      worker.onmessage = event => { if (waiting) { const resolve = waiting; waiting = null; resolve(event.data) } else inbox.set(inbox.size, event.data) }
      const next = () => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Real local worker did not reply within 90 seconds')), 90_000)
        const done = data => { clearTimeout(timeout); resolve(data) }
        if (inbox.size) { const first = inbox.keys().next().value; const value = inbox.get(first); inbox.delete(first); done(value) } else waiting = done
      })
      const origin = location.origin; const started = performance.now()
      try {
        worker.postMessage({ type: 'init', bundleUrl: `${origin}/companion-assets/vision_bundle.js`, wasmRoot: `${origin}/companion-assets/wasm`, modelUrl: `${origin}/companion-assets/pose_landmarker_lite.task` })
        const ready = await next(); if (ready.type !== 'ready') throw new Error(JSON.stringify(ready))
        const initializedAt = performance.now(); const frames = []
        const source = document.createElement('canvas'); source.width = 320; source.height = 240
        const ctx = source.getContext('2d'); ctx.fillStyle = '#6b7280'; ctx.fillRect(0, 0, 320, 240)
        for (let id = 1; id <= 8; id += 1) {
          const bitmap = await createImageBitmap(source); const capturedAt = performance.now()
          worker.postMessage({ type: 'frame', id, capturedAt, width: 320, height: 240, bitmap }, [bitmap])
          const result = await next(); if (result.type !== 'result') throw new Error(JSON.stringify(result))
          frames.push({ id: result.id, detectedBodies: result.landmarks.length, inferenceMs: result.inferenceMs, dispatchToResultMs: performance.now() - capturedAt })
        }
        return { ready, initWallMs: initializedAt - started, syntheticSource: 'uniform grey 320x240 canvas, no human image', frames }
      } finally { worker.postMessage({ type: 'dispose' }); worker.terminate() }
    })
    assert.ok(row.worker.frames.every(frame => frame.detectedBodies === 0), 'blank generated images must not be labelled as a tracked person')
    assert.equal((await snapshot(page)).gum.length, 0)
    const times = row.worker.frames.map(frame => frame.inferenceMs).sort((a, b) => a - b)
    row.worker.inferenceP50Ms = times[Math.floor(times.length * 0.5)]; row.worker.inferenceP95Ms = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]
    row.worker.latencyBoundary = 'blank-frame worker timings only, not human movement-to-screen latency or camera posture frequency'
    row.worker.cacheBoundary = 'HTTP cache is disabled by request interception; cached resource/model initialization has not been established by this case'
  })

  await scenario('W02', 'First and repeated real worker initialization in a cache-enabled blank test page', { noRoutes: true, evidenceType: 'same-origin local worker; browser HTTP cache enabled; generated blank image only; NO application, camera or human mirror' }, async (page, row) => {
    const htmlPath = `${out}/worker-cache.html`
    writeFileSync(htmlPath, '<!doctype html><html lang="zh"><meta charset="utf-8"><title>V4 本机模型缓存软件检查</title><body style="font:18px sans-serif;background:#faf8f1;color:#263b31;padding:32px"><h1>本机模型缓存软件检查</h1><p>仅灰色合成画面，无真实相机或人体。测试页面不加载 Gym 应用。</p></body></html>')
    assert.ok(!/^[A-Za-z]:/.test(htmlPath), 'cache harness requires a project-relative GYM_TEST_OUTPUT_ROOT')
    await page.goto(`${base}/${htmlPath.replaceAll('\\', '/')}`)
    // Creating an HTML file in a running Vite tree can trigger one full reload.
    // Settle that dev-server event before starting either model measurement.
    await page.waitForTimeout(1000)
    await page.getByRole('heading', { name: '本机模型缓存软件检查', exact: true }).waitFor()
    row.cacheRuns = []
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const workerCreated = page.waitForEvent('worker')
      await page.evaluate(() => {
        const worker = new Worker('/companion-assets/pose-worker.js')
        const messages = []; let waiting = null
        worker.onmessage = event => { if (waiting) { const resolve = waiting; waiting = null; resolve(event.data) } else messages.push(event.data) }
        worker.onerror = event => {
          const message = { type: 'error', stage: 'worker', message: event.message }
          if (waiting) { const resolve = waiting; waiting = null; resolve(message) } else messages.push(message)
        }
        const next = () => new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Cache worker did not reply within 90 seconds')), 90_000)
          const done = message => { clearTimeout(timeout); resolve(message) }
          if (messages.length) done(messages.shift()); else waiting = done
        })
        window.__cacheSoftwareWorker = { worker, next, started: performance.now() }
        const origin = location.origin
        worker.postMessage({ type: 'init', bundleUrl: `${origin}/companion-assets/vision_bundle.js`, wasmRoot: `${origin}/companion-assets/wasm`, modelUrl: `${origin}/companion-assets/pose_landmarker_lite.task` })
      })
      const actualWorker = await workerCreated
      try {
        const ready = await page.evaluate(async () => {
          const run = window.__cacheSoftwareWorker; const ready = await run.next()
          if (ready.type !== 'ready') throw new Error(JSON.stringify(ready))
          return { ...ready, initWallMs: performance.now() - run.started }
        })
        const blankResult = await page.evaluate(async id => {
          const run = window.__cacheSoftwareWorker
          const source = document.createElement('canvas'); source.width = 320; source.height = 240
          const ctx = source.getContext('2d'); ctx.fillStyle = '#6b7280'; ctx.fillRect(0, 0, 320, 240)
          const bitmap = await createImageBitmap(source); const capturedAt = performance.now()
          run.worker.postMessage({ type: 'frame', id, capturedAt, width: 320, height: 240, bitmap }, [bitmap])
          const result = await run.next(); if (result.type !== 'result') throw new Error(JSON.stringify(result))
          return { detectedBodies: result.landmarks.length, inferenceMs: result.inferenceMs }
        }, attempt)
        const resources = await actualWorker.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ name: entry.name, initiatorType: entry.initiatorType, duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, responseStatus: entry.responseStatus ?? null })))
        row.cacheRuns.push({ attempt, initWallMs: ready.initWallMs, resourceLoadMs: ready.resourceLoadMs, initializationMs: ready.initializationMs, blockedNetworkRequests: ready.blockedNetworkRequests ?? null, resources, blankResult })
      } finally { await page.evaluate(() => { window.__cacheSoftwareWorker.worker.postMessage({ type: 'dispose' }); window.__cacheSoftwareWorker.worker.terminate(); delete window.__cacheSoftwareWorker }) }
    }
    assert.equal(row.cacheRuns.length, 2); assert.ok(row.cacheRuns.every(run => run.blankResult.detectedBodies === 0))
    assert.equal((await snapshot(page)).gum.length, 0)
    const repeated = row.cacheRuns[1].resources.filter(resource => new URL(resource.name).pathname.startsWith('/companion-assets/'))
    row.observedCachedBodies = repeated.filter(resource => resource.encodedBodySize > 0 && resource.transferSize === 0)
    row.observedRevalidatedBodies = repeated.filter(resource => resource.encodedBodySize > 300 && resource.transferSize > 0 && resource.transferSize <= 300)
    row.cacheEvidence = row.observedCachedBodies.length || row.observedRevalidatedBodies.length ? 'cache body reuse evidenced by same-origin ResourceTiming transfer bytes; raw response headers are retained' : 'NOT_CONFIRMED: repeated initialization succeeded but HTTP cache body reuse was not established'
    row.measurementBoundary = 'fresh isolated browser context then second new worker in same context; no Playwright routes or service workers; local server asset access and model reinitialization only; not WAN download latency or human tracking'
  })

  await scenario('V01', 'Short recording of actual preset animation and clear/pixel/side-view interaction', { recordVideo: true, evidenceType: 'recorded real Three rendering driven by preset controls; automated interaction; NO camera or human motion' }, async (page, row) => {
    await openLab(page)
    await page.getByRole('button', { name: '播放动作', exact: true }).click(); await page.waitForTimeout(3150)
    await pausePreset(page); await page.waitForTimeout(1900)
    await page.getByRole('button', { name: '像素', exact: true }).click(); await page.waitForTimeout(2200)
    await page.getByRole('button', { name: '斜侧', exact: true }).click(); await page.waitForTimeout(2000)
    await page.getByRole('button', { name: '侧面', exact: true }).click(); await page.waitForTimeout(1500)
    await page.getByRole('button', { name: '清晰', exact: true }).click(); await page.waitForTimeout(1500)
    await page.getByRole('button', { name: '正面', exact: true }).click()
    await page.getByRole('button', { name: '播放动作', exact: true }).click(); await page.waitForTimeout(2500)
    assert.equal((await snapshot(page)).gum.length, 0)
    row.recordingLabel = 'actual procedural 3D preset; not design mockup, human camera, motion capture or fixed landmark replay'
  })

  await scenario('P01', 'Preset rendering performance over the originally specified 60 second window', { evidenceType: 'headless desktop preset rendering; NOT phone or real pose inference performance' }, async (page, row) => {
    await openLab(page)
    const display = process.env.GYM_COMPANION_PERF_DISPLAY === 'pixel' ? 'pixel' : 'clear'
    await page.getByRole('button', { name: display === 'pixel' ? '像素' : '清晰', exact: true }).click()
    await page.getByRole('button', { name: '播放动作', exact: true }).click()
    const duration = Number(process.env.GYM_COMPANION_PERF_MS || 60000)
    row.performance = await canvasFor(page).evaluate(async (canvas, durationMs) => {
      const gl = canvas.getContext('webgl2'); const info = gl?.getExtension('WEBGL_debug_renderer_info')
      const environment = { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, dpr: devicePixelRatio, canvas: { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, bufferWidth: canvas.width, bufferHeight: canvas.height }, config: { ...canvas.dataset }, gpu: gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable' }
      const intervals = []; let previous = 0; let frames = 0; let presetReplays = 0
      const repeat = setInterval(() => {
        const playback = [...document.querySelectorAll('button')].find(button => button.textContent.trim().endsWith('播放动作'))
        if (playback && !playback.disabled) { playback.click(); presetReplays += 1 }
      }, 100)
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (record.attributeName !== 'data-render-frame') continue
          const now = performance.now(); if (previous) intervals.push(now - previous); previous = now; frames += 1
        }
      })
      observer.observe(canvas, { attributes: true, attributeFilter: ['data-render-frame'] })
      const started = performance.now(); await new Promise(resolve => setTimeout(resolve, durationMs)); const elapsedMs = performance.now() - started; observer.disconnect(); clearInterval(repeat)
      intervals.sort((a, b) => a - b)
      const quantile = fraction => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * fraction))] ?? null
      return { environment, elapsedMs, frames, presetReplays, frameIntervalP50Ms: quantile(0.5), frameIntervalP95Ms: quantile(0.95), medianFps: quantile(0.5) ? 1000 / quantile(0.5) : 0, meanFps: frames * 1000 / elapsedMs }
    }, duration)
    row.performance.method = 'MutationObserver counts data-render-frame updated immediately after each successful actual renderer.render; intervals are frame scheduling intervals, not GPU durations'
    row.performance.poseProtocol = 'both-arm 8-second preset; automation presses Play again when each run finishes; no camera; at most 100ms idle between runs'
    row.performance.originalTarget = { durationMs: 60000, medianFps: 30 }
    row.performance.targetEvaluated = duration >= 60000
    assert.ok(row.performance.frames > 0, 'actual renderer frame counter is observable')
    if (row.performance.targetEvaluated) assert.ok(row.performance.medianFps >= 30, 'original 30 FPS median target')
    else row.performance.limit = 'short smoke window; does not establish the original 60 second target'
  })
} finally { await browser.close(); persist() }

console.log(JSON.stringify({ output: out, passed: results.filter(result => result.pass).length, total: results.length }))
if (results.some(result => !result.pass)) process.exitCode = 1
