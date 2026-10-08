import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = process.env.GYM_RELEASE_URL || 'http://127.0.0.1:4185'
assert.ok(['127.0.0.1', 'gym-iota-self.vercel.app'].includes(new URL(base).hostname))
const out = `evals/releases/check-${Date.now()}`; mkdirSync(out, { recursive: true })
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
const report = { base, kind: 'isolated browser and synthetic local storage; real GET requests, no paid AI or physical camera', checks: [] }
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 390, height: 950 } })
await context.addInitScript(data => {
  if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
  navigator.mediaDevices.getUserMedia = async () => { throw new Error('No camera during release checks') }
}, fixture)
await context.route('**/*', route => {
  const url = new URL(route.request().url())
  if (url.origin !== base || (url.pathname.startsWith('/api/') && url.pathname !== '/api/equipment-status')) return route.abort()
  return route.continue()
})
const page = await context.newPage(); page.setDefaultTimeout(20000)
try {
  for (const [label, path] of [['scan', '/?equipment-scan=1'], ['companion', '/?training-companion=1'], ['library', '/?companion-lab=1']]) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' })
    await page.getByRole('region', { name: '应用版本', exact: true }).getByText('器械与熊猫陪练 · 2026-10-09', { exact: true }).waitFor()
    if (label === 'scan') await page.locator('.equipment-intro img').evaluate(async img => { await img.decode(); if (!img.naturalWidth) throw new Error('Panda image did not load') })
    assert.equal(await page.getByText('页面暂时无法加载', { exact: true }).count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({ path: `${out}/${label}.png` })
    report.checks.push({ label, pass: true })
  }
  await page.goto(base + '/?equipment-scan=1', { waitUntil: 'domcontentloaded' })
  const before = await page.evaluate(() => localStorage.getItem('gym-data-v1'))
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 20000 })
  const registration = await page.evaluate(async () => {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('service worker timeout')), 20000))])
    return { scope: reg.scope, active: reg.active?.state, script: reg.active?.scriptURL }
  })
  assert.equal(registration.active, 'activated')
  await page.getByRole('button', { name: '检查更新', exact: true }).click()
  await page.getByRole('button', { name: '刷新页面', exact: true }).waitFor()
  await page.getByRole('button', { name: '刷新页面', exact: true }).click()
  await page.getByRole('heading', { name: '先认清器械，再开始训练。', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => localStorage.getItem('gym-data-v1')), before)
  report.checks.push({ label: 'PWA worker activated, manual update and reload preserves records', pass: true, registration })
  const manifestResponse = await page.evaluate(async () => { const response = await fetch('/manifest.webmanifest', { signal: AbortSignal.timeout(15000) }); return { status: response.status, value: await response.json() } }); assert.equal(manifestResponse.status, 200)
  const manifest = manifestResponse.value; assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/')
  assert.equal(manifest.shortcuts.length, 3)
  report.checks.push({ label: 'PWA standalone manifest and shortcuts', pass: true })
  report.api = await page.evaluate(async () => { const response = await fetch('/api/equipment-status', { signal: AbortSignal.timeout(15000) }); return { httpStatus: response.status, ...await response.json() } })
} catch (error) { report.error = error.message; process.exitCode = 1; await page.screenshot({ path: `${out}/failure.png` }).catch(() => {}) }
await context.close(); await browser.close()
writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ out, ...report }))
