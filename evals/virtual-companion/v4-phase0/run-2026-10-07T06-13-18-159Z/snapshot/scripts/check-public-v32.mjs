import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
const { chromium } = await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH, 'index.mjs')).href)
const out = `evals/workout-save/v3-2/public-${Date.now()}`
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const records = []
for (const url of ['https://gym-hdfd4x6o6-yuxiang-wang-s-projects.vercel.app', 'https://gym-iota-self.vercel.app']) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const started = Date.now()
  const record = { url, kind: 'read-only anonymous browser availability', authenticated: false }
  try {
    const response = await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' })
    const current = new URL(page.url())
    record.status = response?.status(); record.finalOrigin = current.origin; record.finalPath = current.pathname
    record.title = await page.title(); record.bodyExcerpt = (await page.locator('body').innerText()).slice(0, 600)
    if (current.origin === new URL(url).origin) {
      const asset = await page.locator('script[type=module][src]').getAttribute('src').catch(() => null)
      if (asset) {
        const js = await context.request.get(new URL(asset, url).href, { timeout: 15000 })
        const body = await js.text()
        record.asset = asset; record.assetStatus = js.status()
        record.bundleSha256 = createHash('sha256').update(body).digest('hex')
        record.hasV32Label = body.includes('缺失确认 V3.2')
        record.hasV31Label = body.includes('保存恢复 V3.1')
      }
    }
  } catch (e) { record.error = e.message }
  record.ms = Date.now() - started
  records.push(record); await context.close()
  writeFileSync(`${out}/results.partial.json`, JSON.stringify(records, null, 2))
}
await browser.close()
writeFileSync(`${out}/results.json`, JSON.stringify({ at: new Date().toISOString(), realModelCalls: 0, modelCostUsd: 0, deploymentPerformed: false, records }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ out, records }, null, 2))
