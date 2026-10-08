import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { TEACHING_VIDEOS } from '../src/lib/teachingVideos.ts'
import { PLAN_TEMPLATES } from '../src/lib/planTemplates.ts'

const out = `evals/video-pilot/v3-3/live-${Date.now()}`
mkdirSync(out, { recursive: true })
const report = { at: new Date().toISOString(), kind: 'real anonymous external metadata and media requests, automated isolated Edge; not human/model evaluation', modelCalls: 0, modelCostUsd: 0, infrastructureCost: 'not measured', results: [] }
function persist() { writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2)) }
for (const video of TEACHING_VIDEOS) {
  if (process.env.GYM_VIDEO_FILTER && video.videoId !== process.env.GYM_VIDEO_FILTER) continue
  const row = { name: video.exercise, videoId: video.videoId, sourceUrl: video.sourceUrl, kind: 'real YouTube oEmbed metadata, NOT playback', pass: false }
  const start = Date.now()
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video.videoId}`)}&format=json`
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) }); row.status = response.status
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json(); row.title = data.title; row.author = data.author_name; row.embedHtml = data.html
    row.pass = data.html.includes(video.videoId)
  } catch (e) { row.error = e.message; row.cause = e.cause?.code }
  row.ms = Date.now() - start; report.results.push(row); persist(); console.log(JSON.stringify(row))
}
const { chromium } = await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH, 'index.mjs')).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.dayLogs = {}; fixture.exerciseVideos = {}
const template = PLAN_TEMPLATES.find(t => t.id === 'full-body-3day')
fixture.plans = [{ ...template, isActive: true, createdAt: '2026-10-01' }]
for (const video of TEACHING_VIDEOS) {
  if (process.env.GYM_VIDEO_FILTER && video.videoId !== process.env.GYM_VIDEO_FILTER) continue
  const start = Date.now(); const row = { name: video.exercise, videoId: video.videoId, kind: 'actual in-app external playback attempt; no mocked responses', pass: false }
  const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: 'Asia/Shanghai' })
  await context.addInitScript(data => { if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data)) }, fixture)
  const page = await context.newPage(); page.setDefaultTimeout(8000)
  const failedRequests = []
  page.on('requestfailed', request => { const url = new URL(request.url()); failedRequests.push({ host: url.hostname, path: url.pathname, error: request.failure()?.errorText }) })
  try {
    await page.goto(process.env.GYM_TEST_URL || 'http://127.0.0.1:4174')
    await page.getByRole('button', { name: '训练', exact: true }).click()
    await page.getByRole('button', { name: 'Day 1 · 全身 A', exact: true }).click()
    const storedBefore = await page.evaluate(() => localStorage.getItem('gym-data-v1'))
    await page.getByRole('group', { name: `${video.exercise}训练记录`, exact: true }).getByRole('button', { name: '视频与要领', exact: true }).click()
    await page.getByRole('button', { name: '加载真人示范', exact: true }).click()
    await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('[data-video-state]')?.getAttribute('data-video-state')), { timeout: 18000 })
    row.stateBeforePlay = await page.locator('[data-video-state]').getAttribute('data-video-state')
    if (row.stateBeforePlay !== 'ready') throw new Error(await page.getByRole('alert').innerText())
    row.iframeSources = await page.locator('iframe').evaluateAll(nodes => nodes.map(n => n.src))
    const frame = page.frameLocator('iframe').first()
    await frame.getByRole('button', { name: /播放|Play/i }).first().click({ timeout: 8000 })
    await page.locator('[data-video-state="playing"]').waitFor({ timeout: 15000 })
    row.observedPlaying = true
    row.firstMediaState = await frame.locator('video').evaluate(v => ({ currentTime: v.currentTime, paused: v.paused, readyState: v.readyState }))
    await page.waitForTimeout(3500)
    row.secondMediaState = await frame.locator('video').evaluate(v => ({ currentTime: v.currentTime, paused: v.paused, readyState: v.readyState }))
    row.pass = row.secondMediaState.currentTime > row.firstMediaState.currentTime + 1
    row.storageUnchanged = storedBefore === await page.evaluate(() => localStorage.getItem('gym-data-v1'))
    if (!row.storageUnchanged) row.pass = false
  } catch (e) { row.error = e.message }
  row.visibleState = await page.locator('[data-video-state]').getAttribute('data-video-state').catch(() => null)
  row.message = await page.locator('[data-video-state]').innerText().catch(() => null)
  row.failedRequests = failedRequests; row.ms = Date.now() - start
  await page.screenshot({ path: `${out}/${video.videoId}.png`, fullPage: true }).catch(() => {})
  await page.getByRole('dialog').screenshot({ path: `${out}/${video.videoId}-player.png` }).catch(() => {})
  await context.close(); report.results.push(row); persist(); console.log(JSON.stringify(row))
}
for (const url of ['https://gym-iota-self.vercel.app', 'https://gym-hdfd4x6o6-yuxiang-wang-s-projects.vercel.app']) {
  const context = await browser.newContext(); const page = await context.newPage(); const start = Date.now()
  const row = { kind: 'read-only anonymous public availability; no deployment', url }
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    const current = new URL(page.url()); row.status = response?.status(); row.finalOrigin = current.origin; row.finalPath = current.pathname
    row.bodyExcerpt = (await page.locator('body').innerText()).slice(0, 300)
  } catch (e) { row.error = e.message }
  row.ms = Date.now() - start; report.results.push(row); persist(); await context.close()
}
await browser.close()
console.log(JSON.stringify({ out, playbackPassed: report.results.filter(r => r.kind.startsWith('actual') && r.pass).length }))
