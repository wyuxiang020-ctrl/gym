import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4186'
const out = `evals/equipment-scan/live-video-${Date.now()}`
mkdirSync(out, { recursive: true })
const report = { kind: 'Real external playback attempt, isolated Edge; no fake player events or API responses', modelCalls: 0,  results: [] }
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
for (const [width, unilateral, seconds] of [[390, false, 60], [1100, true, 60]]) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block' })
  const row = { width, unilateral, expectedSeconds: seconds, playbackPassed: false, recoveryPassed: false, failedRequests: [] }
  await context.route('**/api/identify-equipment', route => route.abort())
  await context.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new Error('No physical camera in this check') } })
  const page = await context.newPage(); page.setDefaultTimeout(8000)
  page.on('requestfailed', request => { const url = new URL(request.url()); row.failedRequests.push({ host: url.hostname, path: url.pathname, error: request.failure()?.errorText }) })
  try {
    await page.goto(`${base}/?equipment-scan=1`)
    const before = await page.evaluate(() => localStorage.getItem('gym-data-v1'))
    await page.getByRole('button', { name: '手动选择坐姿推胸机', exact: true }).click()
    if (unilateral) { await page.getByRole('button', { name: /^单臂推胸/ }).click(); await page.getByRole('button', { name: '符合条件，选择单臂' }).click() }
    await page.getByRole('button', { name: '确认是坐姿推胸机', exact: true }).click()
    assert.equal(await page.locator('iframe').count(), 0)
    await page.getByRole('button', { name: `查看示范 · ${seconds} 秒`, exact: true }).click()
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('[data-video-state]')?.getAttribute('data-video-state')), null, { timeout: 20000 })
    row.state = await page.locator('[data-video-state]').getAttribute('data-video-state')
    if (row.state === 'ready') {
      try {
        const frame = page.frameLocator('iframe').first()
        await frame.getByRole('button', { name: /播放|Play/i }).first().click()
        await page.locator('[data-video-state="playing"]').waitFor({ timeout: 18000 })
        row.first = await frame.locator('video').evaluate(video => ({ time: video.currentTime, paused: video.paused, ready: video.readyState, duration: video.duration }))
        await page.waitForTimeout(3500)
        row.second = await frame.locator('video').evaluate(video => ({ time: video.currentTime, paused: video.paused, ready: video.readyState, duration: video.duration }))
        row.playbackPassed = !row.second.paused && row.second.time > row.first.time + 1 && row.second.duration - (unilateral ? 12 : 0) >= 40 && row.second.duration - (unilateral ? 12 : 0) <= 61
      } catch (error) { row.playbackError = error.message }
    }
    if (row.playbackPassed && unilateral) {
      assert.ok(row.first.time >= 11 && row.first.time < 18, 'Excerpt starts around 12 seconds')
      const src = new URL(await page.locator('iframe').getAttribute('src'))
      assert.equal(src.searchParams.get('start'), '12'); assert.equal(src.searchParams.get('end'), '72')
    }
    row.message = await page.locator('[data-video-state]').innerText()
    await page.locator('[data-video-state]').screenshot({ path: `${out}/player-${width}.png` })
    await page.getByRole('button', { name: '下一步：训练记录', exact: true }).click()
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
