import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseExerciseResource } from '../src/lib/exerciseResource.ts'

const out = `evals/workout-save/v3-2/results/exercise-resource-${Date.now()}`
mkdirSync(out, { recursive: true })
const results = []
function persist() {
  writeFileSync(`${out}/results.json`, JSON.stringify({
    version: 'exercise-resource-v3.2',
    evidenceType: 'automated software tests; isolated synthetic data; no model calls or human participants',
    modelCalls: 0, modelCost: 0, results,
  }, null, 2))
}
function unit(name, run) {
  const started = Date.now()
  const result = { name, kind: 'pure-function', pass: false }
  try { run(); result.pass = true } catch (error) { result.error = error.message }
  result.ms = Date.now() - started
  results.push(result); persist(); console.log(JSON.stringify(result))
}

unit('01 ordinary HTTPS webpage with fragment', () => {
  const parsed = parseExerciseResource(' https://learn.example.test/tutorial?v=1#setup ')
  assert.deepEqual(parsed, { ok: true, resource: { url: 'https://learn.example.test/tutorial?v=1#setup', hostname: 'learn.example.test', kind: 'webpage' } })
})
unit('02 HTTP webpage allowed without fetching', () => {
  assert.equal(parseExerciseResource('http://learn.example.test/guide').resource.kind, 'webpage')
})
unit('03 legacy direct videos and signed queries', () => {
  for (const extension of ['mp4', 'MP4', 'webm', 'ogg', 'ogv', 'm4v']) {
    assert.equal(parseExerciseResource(`https://video.example.test/demo.${extension}?token=synthetic#t=5`).resource.kind, 'video')
  }
})
unit('04 a webpage mentioning mp4 is not embedded', () => {
  for (const value of ['https://learn.example.test/mp4', 'https://learn.example.test/watch?file=demo.mp4', 'https://learn.example.test/demo.mp4.html']) {
    assert.equal(parseExerciseResource(value).resource.kind, 'webpage')
  }
})
unit('05 rejects scripts data file protocol-relative and malformed URLs', () => {
  for (const value of ['', 'javascript:alert(1)', 'data:text/html,test', 'file:///demo.mp4', '//learn.example.test', 'https:learn.example.test', 'https://', 'https://[bad-host', 'ftp://learn.example.test/demo.mp4']) {
    assert.equal(parseExerciseResource(value).ok, false, value)
  }
})
unit('06 rejects credentials and control or whitespace characters', () => {
  for (const value of ['https://user:password@learn.example.test/demo.mp4', 'https://user@learn.example.test', 'https://u%73er@learn.example.test', 'https://learn.example.test/a b', 'https://learn.ex\nample.test', 'https://learn.example.test/a\u0000b']) {
    assert.equal(parseExerciseResource(value).ok, false, value)
  }
})
unit('07 maximum length agrees with existing data validation', () => {
  assert.equal(parseExerciseResource(`https://learn.example.test/${'a'.repeat(2048)}`).ok, false)
  assert.equal(parseExerciseResource(`https://learn.example.test/${'中'.repeat(400)}`).ok, false)
})

if (process.env.GYM_RESOURCE_BROWSER === '1') {
  const playwrightPath = process.env.GYM_PLAYWRIGHT_PATH
  const { chromium } = playwrightPath ? await import(pathToFileURL(resolve(playwrightPath, 'index.mjs')).href) : await import('playwright')
  const browser = await chromium.launch({ headless: true, channel: process.env.GYM_BROWSER_CHANNEL || 'msedge' })
  const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4173'
  const width = Number(process.env.GYM_VIEWPORT_WIDTH || 820)
  const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
  fixture.dayLogs = {}; fixture.exerciseVideos = {}
  async function openDetail(page) {
    await page.getByRole('button', { name: '训练', exact: true }).click()
    await page.getByRole('button', { name: '动作库', exact: true }).click()
    await page.getByRole('button', { name: '杠铃卧推', exact: true }).click()
    await page.getByText('我的教学资料', { exact: true }).waitFor()
  }
  async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')).exerciseVideos) }
  async function failStorage(page, value) {
    await page.evaluate(value => {
      window.__resourceFailWrite = value
      if (!window.__resourceOriginalWrite) {
        window.__resourceOriginalWrite = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (window.__resourceFailWrite && key === 'gym-data-v1') throw new DOMException('synthetic quota failure', 'QuotaExceededError')
          return window.__resourceOriginalWrite.call(this, key, value)
        }
      }
    }, value)
  }
  async function scenario(name, initial, run) {
    const started = Date.now()
    const result = { name, kind: 'browser-fault-injection', viewportWidth: width, pass: false }
    const context = await browser.newContext({ viewport: { width, height: 1024 }, timezoneId: 'Asia/Shanghai' })
    await context.addInitScript(data => {
      if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    }, { ...fixture, exerciseVideos: initial })
    const page = await context.newPage(); page.setDefaultTimeout(6000)
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    try {
      await page.goto(base); await openDetail(page)
      await run(page, context)
      assert.deepEqual(errors, [])
      result.pass = true
    } catch (error) { result.error = error.message }
    result.ms = Date.now() - started
    result.screenshot = `${out}/${name.slice(0, 2)}.png`
    await page.screenshot({ path: result.screenshot, fullPage: true })
    await context.close(); results.push(result); persist(); console.log(JSON.stringify(result))
  }
  await scenario('08 webpage save reopen and user-initiated external opening', {}, async (page, context) => {
    const requests = []
    await context.route('https://learn.example.test/**', route => {
      requests.push(route.request().url())
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Synthetic external teaching page</h1>' })
    })
    await page.getByLabel('教学资料链接').fill('https://learn.example.test/guide')
    await page.getByRole('button', { name: '保存资料链接', exact: true }).click()
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://learn.example.test/guide' })
    assert.equal(await page.locator('iframe, video').count(), 0)
    const link = page.getByRole('link', { name: /在新标签页打开教学资料/ })
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
    assert.deepEqual(requests, [])
    await page.reload(); await openDetail(page)
    const nextTab = context.waitForEvent('page')
    await page.getByRole('link', { name: /在新标签页打开教学资料/ }).click()
    const external = await nextTab; await external.waitForLoadState()
    assert.deepEqual(requests, ['https://learn.example.test/guide'])
    assert.equal(await external.evaluate(() => window.opener === null), true)
    await external.close()
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://learn.example.test/guide' })
  })
  await scenario('09 legacy mp4 preserved with playback failure fallback', { '杠铃卧推': 'https://video.example.test/demo.mp4' }, async page => {
    assert.equal(await page.locator('video').getAttribute('src'), 'https://video.example.test/demo.mp4')
    assert.equal(await page.locator('video').getAttribute('preload'), 'none')
    await page.locator('video').dispatchEvent('error')
    await page.getByText(/视频无法在这里播放/).waitFor()
    assert.equal(await page.getByRole('link', { name: /在新标签页打开教学资料/ }).getAttribute('href'), 'https://video.example.test/demo.mp4')
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://video.example.test/demo.mp4' })
  })
  await scenario('10 invalid and credential links never saved or activated', { '杠铃卧推': 'javascript:alert(1)' }, async page => {
    await page.getByText(/原链接不符合安全格式/).waitFor()
    assert.equal(await page.locator('a, video').count(), 0)
    await page.getByRole('button', { name: '换一个链接', exact: true }).click()
    for (const value of ['javascript:alert(2)', 'https://user:password@learn.example.test']) {
      await page.getByLabel('教学资料链接').fill(value)
      await page.getByRole('button', { name: '保存资料链接', exact: true }).click()
      await page.getByRole('alert').waitFor()
      assert.equal(await page.getByLabel('教学资料链接').inputValue(), value)
      assert.deepEqual(await stored(page), { '杠铃卧推': 'javascript:alert(1)' })
    }
  })
  await scenario('11 failed save retains old URL and draft then retry succeeds', { '杠铃卧推': 'https://learn.example.test/old' }, async page => {
    await page.getByRole('button', { name: '换一个链接', exact: true }).click()
    await page.getByLabel('教学资料链接').fill('https://learn.example.test/new')
    await failStorage(page, true)
    await page.getByRole('button', { name: '保存资料链接', exact: true }).click()
    await page.getByText(/保存失败，原链接未更改/).waitFor()
    assert.equal(await page.getByLabel('教学资料链接').inputValue(), 'https://learn.example.test/new')
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://learn.example.test/old' })
    await failStorage(page, false)
    await page.getByRole('button', { name: '保存资料链接', exact: true }).click()
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://learn.example.test/new' })
    await page.reload(); await openDetail(page)
    assert.equal(await page.getByRole('link', { name: /在新标签页打开教学资料/ }).getAttribute('href'), 'https://learn.example.test/new')
  })
  await scenario('12 cancel and failed delete preserve existing URL', { '杠铃卧推': 'https://learn.example.test/old' }, async page => {
    await page.getByRole('button', { name: '换一个链接', exact: true }).click()
    await page.getByLabel('教学资料链接').fill('https://learn.example.test/cancelled')
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://learn.example.test/old' })
    await failStorage(page, true)
    await page.getByRole('button', { name: '删除资料链接', exact: true }).click()
    await page.getByText(/删除失败，原链接仍保留/).waitFor()
    assert.equal(await page.getByRole('link', { name: /在新标签页打开教学资料/ }).getAttribute('href'), 'https://learn.example.test/old')
    assert.deepEqual(await stored(page), { '杠铃卧推': 'https://learn.example.test/old' })
    await failStorage(page, false)
    await page.getByRole('button', { name: '删除资料链接', exact: true }).click()
    await page.getByLabel('教学资料链接').waitFor()
    assert.deepEqual(await stored(page), {})
  })
  await browser.close()
}
console.log(JSON.stringify({ output: out, passed: results.filter(result => result.pass).length, total: results.length }))
if (results.some(result => !result.pass)) process.exitCode = 1
