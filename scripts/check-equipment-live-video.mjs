import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = 'http://127.0.0.1:4175'
const out = `evals/equipment-scan/live-video-${Date.now()}`
mkdirSync(out, { recursive: true })
const report = { kind: 'Real external playback attempt, isolated Edge; no fake player events or API responses', modelCalls: 0, videoId: '_1rj1FY-b1Q', results: [] }
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
for (const width of [390, 1100]) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block' })
  const row = { width, playbackPassed: false, recoveryPassed: false, failedRequests: [] }
  await context.route('**/api/identify-equipment', route => route.abort())
  await context.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new Error('No physical camera in this check') } })
  const page = await context.newPage(); page.setDefaultTimeout(8000)
  page.on('requestfailed', request => { const url = new URL(request.url()); row.failedRequests.push({ host: url.hostname, path: url.pathname, error: request.failure()?.errorText }) })
  try {
    await page.goto(`${base}/?equipment-scan=1`)
    const before = await page.evaluate(() => localStorage.getItem('gym-data-v1'))
    await page.getByRole('button', { name: '手动选择坐姿推胸机', exact: true }).click()
    await page.getByRole('button', { name: '确认是坐姿推胸机', exact: true }).click()
    await page.getByRole('checkbox', { name: /我已核对标牌/ }).check()
    await page.getByRole('button', { name: '查看该型号真人示范', exact: true }).click()
    assert.equal(await page.locator('iframe').count(), 0)
    await page.getByRole('button', { name: '加载真人示范', exact: true }).click()
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('[data-video-state]')?.getAttribute('data-video-state')), null, { timeout: 20000 })
    row.state = await page.locator('[data-video-state]').getAttribute('data-video-state')
    if (row.state === 'ready') {
      try {
        const frame = page.frameLocator('iframe').first()
        await frame.getByRole('button', { name: /播放|Play/i }).first().click()
        await page.locator('[data-video-state="playing"]').waitFor({ timeout: 18000 })
        row.first = await frame.locator('video').evaluate(video => ({ time: video.currentTime, paused: video.paused, ready: video.readyState }))
        await page.waitForTimeout(3500)
        row.second = await frame.locator('video').evaluate(video => ({ time: video.currentTime, paused: video.paused, ready: video.readyState }))
        row.playbackPassed = !row.second.paused && row.second.time > row.first.time + 1
      } catch (error) { row.playbackError = error.message }
    }
    row.message = await page.locator('[data-video-state]').innerText()
    await page.locator('[data-video-state]').screenshot({ path: `${out}/player-${width}.png` })
    await page.getByRole('button', { name: '返回器械资料', exact: true }).click()
    assert.equal(await page.locator('iframe').count(), 0)
    await page.getByRole('button', { name: '带入训练记录 ↗', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('gym-data-v1')), before)
    row.recoveryPassed = true
  } catch (error) { row.error = error.message }
  report.results.push(row)
  writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(row)); await context.close()
}
await browser.close(); console.log(out)
