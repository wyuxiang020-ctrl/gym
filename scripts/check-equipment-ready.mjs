import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const base = 'http://127.0.0.1:4175'
const out = `evals/equipment-scan/ready-${Date.now()}`; mkdirSync(out, { recursive: true })
const status = await fetch(`${base}/api/equipment-status`).then(response => response.json())
assert.equal(status.available, true)
// Invalid bytes are rejected before authorization or upstream processing.
const invalid = await fetch(`${base}/api/identify-equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }) })
assert.equal(invalid.status, 400)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const views = []
for (const width of [390, 1100]) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block' })
  let uploads = 0
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/identify-equipment') { uploads++; return route.abort() }
    return url.origin === base ? route.continue() : route.abort()
  })
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/?equipment-scan=1`)
  await page.getByText('识别接口已连接。上传后才发起识别，实际结果以本次响应为准。').waitFor()
  assert.equal(uploads, 0); assert.deepEqual(errors, [])
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: `${out}/entry-${width}.png`, fullPage: true })
  views.push({ width, uploads, errors }); await context.close()
}
await browser.close()
writeFileSync(`${out}/results.json`, JSON.stringify({ status, invalidStatus: invalid.status, views, cloudModelCalls: 0, note: 'Real local proxy and configuration, not upstream quality or billing verification' }, null, 2)); console.log(out)
