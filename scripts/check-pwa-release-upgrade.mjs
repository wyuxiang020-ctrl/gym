import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = 'https://gym-iota-self.vercel.app'
const out = `evals/releases/upgrade-${Date.now()}`; mkdirSync(out, { recursive: true })
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
const report = { base, kind: 'isolated real production service-worker upgrade with synthetic records; no paid AI or camera', pass: false }
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 390, height: 950 } })
await context.addInitScript(data => { if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data)); navigator.mediaDevices.getUserMedia = async () => { throw new Error('No camera') } }, fixture)
await context.route('**/api/**', route => route.abort())
const page = await context.newPage()
try {
  await page.goto(base)
  await page.evaluate(async () => { await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('service worker timeout')), 20000))]) })
  report.initiallyNew = await page.getByText('器械与熊猫陪练 · 2026-10-09', { exact: true }).count() > 0
  report.beforeWorker = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)
  const before = await page.evaluate(() => localStorage.getItem('gym-data-v1'))
  const initialHtml = report.initiallyNew ? '' : await page.evaluate(() => fetch('/?release-initial=20261009', { cache: 'no-store', signal: AbortSignal.timeout(15000) }).then(response => response.text()))
  console.log(JSON.stringify({ out, initiallyNew: report.initiallyNew, phase: report.initiallyNew ? 'current release ready; checking refresh' : 'old client ready; waiting for production update' }))
  if (!report.initiallyNew) {
    const deadline = Date.now() + 12 * 60000
    let changed = false
    while (Date.now() < deadline) {
      await page.waitForTimeout(10000)
      const current = await page.evaluate(() => fetch('/?release-check=20261009', { cache: 'no-store', signal: AbortSignal.timeout(15000) }).then(response => response.text()))
      if (current !== initialHtml) { changed = true; break }
    }
    assert.ok(changed, 'Production did not change within observation period')
  }
  await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; await reg.update() })
  await page.waitForTimeout(4000)
  await page.reload()
  await page.getByText('器械与熊猫陪练 · 2026-10-09', { exact: true }).waitFor({ timeout: 30000 })
  assert.equal(await page.evaluate(() => localStorage.getItem('gym-data-v1')), before)
  report.pass = true
  report.observedOldToNew = !report.initiallyNew
  await page.screenshot({ path: `${out}/updated.png` })
} catch (error) { report.error = error.message; process.exitCode = 1; await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}) }
await context.close(); await browser.close()
writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ out, ...report }))
