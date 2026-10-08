import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const playwrightPath = process.env.GYM_PLAYWRIGHT_PATH || 'C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
const { chromium } = await import(pathToFileURL(resolve(playwrightPath, 'index.mjs')).href)
const width = Number(process.env.GYM_VIEWPORT_WIDTH || 820)
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4174'
const startedAt = new Date().toISOString()
const out = `evals/video-pilot/v3-3/player-${width}-${Date.now()}`
mkdirSync(out, { recursive: true })
const sourcePaths = [
  'src/components/workout/TeachingVideoPlayer.tsx',
  'src/components/workout/ExerciseDetailSheet.tsx',
  'src/lib/teachingVideos.ts',
  'scripts/check-teaching-player-v33.mjs',
]
const sourceHashes = Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.dayLogs = {}
fixture.exerciseVideos = {}
const results = []
const browser = await chromium.launch({ headless: true, channel: process.env.GYM_BROWSER_CHANNEL || 'msedge' })

function persist() {
  writeFileSync(`${out}/results.json`, JSON.stringify({
    version: 'teaching-player-v3.3', startedAt, base, viewportWidth: width,
    evidenceType: 'automated browser software tests; synthetic profile; fixed YouTube API events; fault injection; NO real video playback, model calls or human participants',
    timing: 'ms is machine wall-clock duration; clockMs in timeout cases is an explicitly advanced Playwright virtual clock, not real network latency or user task time',
    modelCalls: 0, modelCostUsd: 0, infrastructureCostUsd: null,
    sourceHashes, results,
  }, null, 2))
}

// This fixture deliberately does not implement media playback. The app creates its
// own iframe; requests for that iframe are fulfilled with a labelled inert page.
function installFixedYouTubeApi() {
  const replay = window.__ytReplay || { instances: [], calls: [], destroyed: 0 }
  window.__ytReplay = replay
  window.YT = {
    Player: class {
      constructor(iframe, options) {
        this.iframe = iframe
        this.events = options.events
        this.destroyed = false
        replay.instances.push(this)
        replay.calls.push({ type: 'construct', index: replay.instances.length - 1 })
      }
      destroy() {
        this.destroyed = true
        replay.destroyed += 1
        this.iframe.remove()
        replay.calls.push({ type: 'destroy' })
      }
    },
  }
  window.__ytEmit = (index, event, data) => {
    const instance = replay.instances[index]
    if (!instance) throw new Error(`No fixed-response player instance ${index}`)
    replay.calls.push({ type: 'event', index, event, data })
    // Intentionally allow late events from destroyed players to test the guard.
    instance.events[event]?.({ target: instance, data })
  }
}

async function poll(read, expected, label) {
  const deadline = Date.now() + 7000
  let actual
  do {
    actual = await read()
    if (actual === expected) return
    await delay(25)
  } while (Date.now() < deadline)
  assert.equal(actual, expected, label)
}
const state = page => page.locator('[data-video-state]').getAttribute('data-video-state')
const expectState = (page, expected) => poll(() => state(page), expected, `expected player state ${expected}`)
const instanceCount = page => page.evaluate(() => window.__ytReplay?.instances.length || 0)
const emit = (page, event, data, index = 0) => page.evaluate(({ index, event, data }) => window.__ytEmit(index, event, data), { index, event, data })
const stored = page => page.evaluate(() => localStorage.getItem('gym-data-v1'))

async function openDetail(page) {
  await page.getByRole('button', { name: '训练', exact: true }).click()
  await page.getByRole('button', { name: '动作库', exact: true }).click()
  await page.getByRole('button', { name: '杠铃卧推', exact: true }).click()
  await page.locator('[data-video-state]').waitFor()
}
async function load(page, virtualClock = false) {
  const button = page.getByRole('button', { name: '加载真人示范', exact: true })
  if (virtualClock) await button.dispatchEvent('click')
  else await button.click()
  await expectState(page, 'loading')
}
async function ready(page, index = 0) {
  await poll(() => instanceCount(page), index + 1, 'fixed API player construction')
  await emit(page, 'onReady', undefined, index)
  await expectState(page, 'ready')
}
async function freezeClock(page) {
  await page.clock.install({ time: new Date('2026-10-01T04:00:00.000Z') })
  await page.clock.pauseAt(new Date('2026-10-01T04:00:01.000Z'))
}

async function scenario(id, name, options, run) {
  if (process.env.GYM_CASE_FILTER && !id.startsWith(process.env.GYM_CASE_FILTER)) return
  const recordVideo = process.env.GYM_RECORD_DEMOS === '1' && ['P02', 'P06'].includes(id)
    ? { dir: out, size: { width, height: 1024 } } : undefined
  const context = await browser.newContext({ viewport: { width, height: 1024 }, timezoneId: 'Asia/Shanghai', serviceWorkers: 'block', recordVideo })
  await context.addInitScript(data => {
    localStorage.setItem('gym-data-v1', JSON.stringify(data))
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div')
      banner.textContent = 'Gym V3.3 · 合成资料 / 固定 YouTube 事件 · 自动化测试，非真实播放或真人'
      Object.assign(banner.style, { position: 'fixed', top: '0', left: '0', zIndex: '100', background: '#78350f', color: 'white', fontSize: '11px', padding: '4px', width: '100%', pointerEvents: 'none' })
      document.body.append(banner)
    })
  }, fixture)
  const requests = []
  const existingPageRequests = []
  const unexpectedExternalRequests = []
  let apiRequests = 0
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(base).origin) return route.continue()
    if (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2') {
      existingPageRequests.push({ url: url.href, kind: 'existing page font stylesheet', action: 'blocked in isolated test' })
      return route.abort('blockedbyclient')
    }
    unexpectedExternalRequests.push(url.href)
    return route.abort('blockedbyclient')
  })
  await context.route(/https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com)\//, async route => {
    const url = route.request().url()
    requests.push({ url, at: new Date().toISOString(), kind: route.request().resourceType() })
    if (url === 'https://www.youtube.com/iframe_api') {
      apiRequests += 1
      if (options.abortFirstApi && apiRequests === 1) return route.abort('failed')
      const body = options.deferApi
        ? `window.__deferredApiCallback = window.onYouTubeIframeAPIReady; window.__installDeferredApi = ${installFixedYouTubeApi.toString()}; window.__apiRequested = true;`
        : `(${installFixedYouTubeApi.toString()})(); window.onYouTubeIframeAPIReady?.();`
      return route.fulfill({ status: 200, contentType: 'application/javascript', body })
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="zh"><body style="color:white;background:#171717;font:14px sans-serif">固定响应占位：不含真实视频。播放器事件由自动化脚本回放。</body></html>' })
  })
  // Unexpected external requests are blocked as well; this suite cannot establish
  // actual media availability, platform permissions, geographic access or latency.
  await context.route('**/api/**', route => route.abort('blockedbyclient'))
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const row = { id, name, kind: 'fixed-response browser test', attempt: 1, at: new Date().toISOString(), pass: false }
  const started = Date.now()
  try {
    await page.goto(base)
    await openDetail(page)
    const before = await stored(page)
    await run(page, row, requests)
    assert.equal(await stored(page), before, 'teaching player must not mutate stored workout/profile data')
    assert.deepEqual(unexpectedExternalRequests, [], 'no unexpected third-party requests')
    assert.deepEqual(pageErrors, [], 'no uncaught page errors')
    row.pass = true
  } catch (error) {
    row.error = error.message
    row.stack = error.stack
  }
  row.ms = Date.now() - started
  row.finalState = await state(page).catch(() => 'unmounted')
  row.networkRequests = requests
  row.existingPageRequests = existingPageRequests
  row.blockedUnexpectedRequests = unexpectedExternalRequests
  row.pageErrors = pageErrors
  row.replay = await page.evaluate(() => window.__ytReplay ? {
    created: window.__ytReplay.instances.length, destroyed: window.__ytReplay.destroyed, calls: window.__ytReplay.calls,
  } : null).catch(() => null)
  row.screenshot = `${out}/${id}.png`
  await page.screenshot({ path: row.screenshot, fullPage: true, animations: 'disabled' }).catch(error => { row.screenshotError = error.message })
  const video = page.video()
  await context.close()
  if (video) row.video = await video.path()
  results.push(row)
  writeFileSync(`${out}/${id}.json`, JSON.stringify(row, null, 2))
  persist()
  console.log(JSON.stringify({ id, pass: row.pass, ms: row.ms, error: row.error }))
}

try {
  await scenario('P01', 'No YouTube or media requests before explicit loading; source remains accessible', {}, async (page, row, requests) => {
    await delay(200)
    assert.equal(await state(page), 'idle')
    assert.equal(await page.locator('iframe').count(), 0)
    assert.equal(await page.locator('script[src*="youtube"]').count(), 0)
    assert.deepEqual(requests, [])
    const link = page.getByRole('link', { name: '打开视频来源 ↗', exact: true })
    const url = new URL(await link.getAttribute('href'))
    assert.equal(url.protocol, 'https:')
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
    row.sourceUrl = url.href
  })

  await scenario('P02', 'Consent loads private embed; iframe load/ready is not playback; state events are distinct', {}, async page => {
    await load(page)
    await poll(() => instanceCount(page), 1, 'player created')
    const iframe = page.locator('iframe')
    const src = new URL(await iframe.getAttribute('src'))
    assert.equal(src.origin, 'https://www.youtube-nocookie.com')
    assert.equal(src.searchParams.get('origin'), new URL(base).origin)
    assert.equal(src.searchParams.get('controls'), '1')
    assert.equal(src.searchParams.get('autoplay'), '0')
    assert.equal(src.searchParams.get('enablejsapi'), '1')
    assert.equal(await iframe.getAttribute('referrerpolicy'), 'strict-origin-when-cross-origin')
    await iframe.dispatchEvent('load')
    assert.equal(await state(page), 'loading', 'iframe load is not player-ready or playback evidence')
    await ready(page)
    assert.match(await page.locator('[data-video-state]').innerText(), /尚未确认开始播放/)
    await emit(page, 'onStateChange', 1); await expectState(page, 'playing')
    await emit(page, 'onStateChange', 2); await expectState(page, 'paused')
    await emit(page, 'onStateChange', 0); await expectState(page, 'ended')
    await emit(page, 'onStateChange', 5); await expectState(page, 'ready')
  })

  await scenario('P03', 'Cancel API loading; late API callback cannot resurrect iframe; explicit retry works', { deferApi: true }, async page => {
    await load(page)
    await poll(() => page.evaluate(() => Boolean(window.__apiRequested)), true, 'deferred API loaded')
    await page.getByRole('button', { name: '取消加载视频', exact: true }).click()
    await expectState(page, 'cancelled')
    await page.evaluate(() => { window.__installDeferredApi(); window.__deferredApiCallback?.() })
    assert.equal(await instanceCount(page), 0)
    assert.equal(await page.locator('iframe').count(), 0)
    assert.equal(await page.locator('script[src*="youtube"]').count(), 0)
    await load(page); await ready(page)
  })

  await scenario('P04', 'API initialization has a 15000ms total deadline; late callback stays inert', { deferApi: true }, async (page, row) => {
    await freezeClock(page)
    await load(page, true)
    await poll(() => page.evaluate(() => Boolean(window.__apiRequested)), true, 'deferred API request')
    await page.clock.runFor(14_999)
    assert.equal(await state(page), 'loading')
    await page.clock.runFor(2)
    await expectState(page, 'error')
    assert.match(await page.getByRole('alert').innerText(), /加载超过 15 秒/)
    await page.evaluate(() => { window.__installDeferredApi(); window.__deferredApiCallback?.() })
    assert.equal(await instanceCount(page), 0)
    assert.equal(await page.locator('iframe').count(), 0)
    row.clockMs = 15_001
  })

  await scenario('P05', 'Iframe load without API ready does not escape the shared initialization deadline', {}, async (page, row) => {
    await freezeClock(page); await load(page, true)
    await poll(() => instanceCount(page), 1, 'player construction')
    await page.locator('iframe').dispatchEvent('load')
    await page.clock.runFor(15_001)
    await expectState(page, 'error')
    assert.equal(await page.locator('iframe').count(), 0)
    await emit(page, 'onReady'); await emit(page, 'onStateChange', 1)
    assert.equal(await state(page), 'error')
    row.clockMs = 15_001
  })

  await scenario('P06', 'Repeated buffering does not reset 15000ms deadline; error preserves source and return', {}, async (page, row) => {
    await freezeClock(page); await load(page, true); await ready(page)
    await emit(page, 'onStateChange', 1); await expectState(page, 'playing')
    await emit(page, 'onStateChange', 3); await expectState(page, 'buffering')
    await page.clock.runFor(10_000)
    await emit(page, 'onStateChange', 3)
    await page.clock.runFor(4_999)
    assert.equal(await state(page), 'buffering')
    await page.clock.runFor(2)
    await expectState(page, 'error')
    assert.match(await page.getByRole('alert').innerText(), /缓冲超过 15 秒/)
    assert.equal(await page.locator('iframe').count(), 0)
    assert.equal(await page.getByRole('link', { name: '打开视频来源 ↗', exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: '返回上一页面', exact: true }).count(), 1)
    row.clockMs = 15_001
  })

  for (const [index, code, text] of [[7, 100, /删除|私密|不存在/], [8, 101, /不允许/], [9, 150, /不允许/], [10, 153, /页面来源/]]) {
    await scenario(`P${String(index).padStart(2, '0')}`, `Platform error ${code} is explained and does not discard context`, {}, async (page, row) => {
      await load(page); await ready(page)
      await emit(page, 'onError', code); await expectState(page, 'error')
      assert.match(await page.getByRole('alert').innerText(), text)
      assert.equal(await page.locator('iframe').count(), 0)
      assert.equal(await page.getByRole('link', { name: '打开视频来源 ↗', exact: true }).count(), 1)
      row.errorCode = code
      if (code === 100) {
        await page.getByRole('button', { name: '重试加载视频', exact: true }).click()
        await expectState(page, 'loading')
        await poll(() => instanceCount(page), 2, 'retry creates one new player')
        await emit(page, 'onStateChange', 1, 0)
        assert.equal(await state(page), 'loading', 'failed previous attempt cannot update the new player')
        await ready(page, 1)
        await emit(page, 'onStateChange', 1, 1); await expectState(page, 'playing')
      }
    })
  }

  await scenario('P11', 'Closing loaded player destroys iframe and ignores late ready/playback events', {}, async page => {
    await load(page); await ready(page)
    await emit(page, 'onStateChange', 1); await expectState(page, 'playing')
    await page.getByRole('button', { name: '关闭视频', exact: true }).click()
    await expectState(page, 'cancelled')
    assert.equal(await page.locator('iframe').count(), 0)
    assert.ok(await page.evaluate(() => window.__ytReplay.destroyed >= 1))
    await emit(page, 'onReady'); await emit(page, 'onStateChange', 1)
    assert.equal(await state(page), 'cancelled')
  })

  await scenario('P12', 'Return unmounts the player; reopening needs fresh consent and retains stored data', {}, async (page, row, requests) => {
    await load(page); await ready(page)
    await page.getByRole('button', { name: '返回上一页面', exact: true }).click()
    assert.equal(await page.locator('[data-video-state]').count(), 0)
    assert.equal(await page.locator('iframe').count(), 0)
    await emit(page, 'onStateChange', 1)
    const requestCount = requests.length
    await page.getByRole('button', { name: '杠铃卧推', exact: true }).click()
    await expectState(page, 'idle')
    assert.equal(await page.locator('iframe').count(), 0)
    assert.equal(requests.length, requestCount)
    row.requestCountAfterReopen = requestCount
  })

  await scenario('P13', 'API network failure is visible; manual retry loads a fresh request', { abortFirstApi: true }, async page => {
    await page.getByRole('button', { name: '加载真人示范', exact: true }).click()
    await expectState(page, 'error')
    assert.match(await page.getByRole('alert').innerText(), /连接失败/)
    await page.getByRole('button', { name: '重试加载视频', exact: true }).click()
    await ready(page)
  })

  await scenario('P14', 'Autoplay-blocked event invites native play and is not labelled playback', {}, async page => {
    await load(page); await ready(page)
    await emit(page, 'onAutoplayBlocked'); await expectState(page, 'ready')
    assert.match(await page.locator('[data-video-state]').innerText(), /尚未确认开始播放/)
  })
} finally {
  await browser.close()
  persist()
}

console.log(JSON.stringify({ output: out, passed: results.filter(result => result.pass).length, total: results.length }))
if (results.some(result => !result.pass)) process.exitCode = 1
