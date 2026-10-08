import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const out = `evals/virtual-companion/v4-lively/recording-${Date.now()}`
mkdirSync(out, { recursive: true })
const { chromium } = await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 820, height: 1024 }, serviceWorkers: 'block', recordVideo: { dir: out, size: { width: 820, height: 1024 } } })
const blocked = [], errors = [], result = { at: new Date().toISOString(), out, kind: 'Actual local preset animations, not human camera video', result: 'RUNNING' }
await context.addInitScript(() => {
  window.__cameraCalls = 0
  const denied = () => { window.__cameraCalls++; return Promise.reject(new DOMException('No camera in animation recording', 'NotAllowedError')) }
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: denied })
})
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url())
  if (url.origin !== 'http://127.0.0.1:4175' || /\/api\/|companion-assets/.test(url.pathname) || request.method() !== 'GET') { blocked.push(url.href); return route.abort() }
  return route.continue()
})
const page = await context.newPage(), video = page.video()
page.on('pageerror', error => errors.push(String(error)))
try {
  await page.goto('http://127.0.0.1:4175/?companion-lab=1'); await page.locator('canvas').waitFor()
  await page.evaluate(() => {
    const label = document.createElement('div'); label.textContent = 'V4.2 · 实际角色动画 · 未开启摄像头'
    Object.assign(label.style, { position: 'fixed', bottom: '0', left: '0', right: '0', padding: '8px', background: '#344a3b', color: 'white', textAlign: 'center', fontSize: '12px', zIndex: '9999' }); document.body.append(label)
  })
  await page.waitForTimeout(1200)
  for (const [label, wait] of [['挥爪招呼', 5200], ['得意抱爪', 4800], ['蓄力蹦跳', 6000], ['左右晃晃', 4600]]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await page.waitForTimeout(wait)
  }
  assert.equal(await page.evaluate(() => window.__cameraCalls), 0); assert.deepEqual(errors, [])
  result.result = 'PASS'
} catch (error) { result.result = 'FAIL'; result.failure = String(error.stack || error) }
finally {
  await context.close(); result.video = `${out}/actual-character-motion.webm`; await video.saveAs(result.video); await browser.close()
  result.blocked = blocked; result.errors = errors
  result.source = Object.fromEntries(['pandaRig.ts', 'characterMotion.ts', 'CompanionLab.tsx', 'PandaStage.tsx'].map(path => [path, createHash('sha256').update(readFileSync(`src/companion/${path}`)).digest('hex')]))
  writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result))
}
if (result.result !== 'PASS') process.exitCode = 1
