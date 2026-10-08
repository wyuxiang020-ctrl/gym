import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const { chromium } = await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH, 'index.mjs')).href)
const output = `evals/video-pilot/v3-3/baseline-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.dayLogs = {}; fixture.exerciseVideos = {}
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 390, height: 900 } })
await context.addInitScript(data => localStorage.setItem('gym-data-v1', JSON.stringify(data)), fixture)
const page = await context.newPage()
const started = Date.now()
await page.goto(process.env.GYM_TEST_URL || 'http://127.0.0.1:4174')
await page.getByRole('button', { name: '训练', exact: true }).click()
await page.getByRole('button', { name: '动作库', exact: true }).click()
await page.getByRole('button', { name: '杠铃卧推', exact: true }).click()
await page.getByText('我的教学资料', { exact: true }).waitFor()
const results = []
for (const [name, selector] of [['built-in selected demonstration', page.getByText('真人动作示范', { exact: true })], ['explicit inline loading', page.getByRole('button', { name: '加载真人示范', exact: true })]]) {
  const row = { name, pass: false }
  try { assert.equal(await selector.count(), 1); row.pass = true } catch (e) { row.error = e.message }
  results.push(row)
}
await page.screenshot({ path: `${output}/before.png`, fullPage: true })
writeFileSync(`${output}/results.json`, JSON.stringify({ version: 'V3.2 baseline judged against new V3.3 requirements', kind: 'automated isolated browser, not human/model/actual media test', at: new Date().toISOString(), ms: Date.now() - started, modelCalls: 0, modelCostUsd: 0, results }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ output, results }))
await browser.close()
