import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const { chromium } = await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH, 'index.mjs')).href)
const width = Number(process.env.GYM_VIEWPORT_WIDTH || 820)
const out = `evals/workout-save/v3-2/browser-${width}-${Date.now()}`
mkdirSync(out, { recursive: true })
const paths = ['src/components/workout/WeightEditor.tsx', 'src/components/workout/NLWorkoutInput.tsx', 'src/components/workout/StrengthLogger.tsx', 'src/components/workout/WorkoutSection.tsx', 'src/lib/types.ts', 'src/lib/strength.ts', 'src/lib/aiValidation.ts', 'src/lib/dataValidation.ts']
const sourceHashes = Object.fromEntries(paths.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]))
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.dayLogs = {}; fixture.plans = []
const unknown = { weight: null, weightState: 'unknown', reps: 8, durationSeconds: null, done: true }
const known = { weight: 50, weightState: 'known', reps: 8, durationSeconds: null, done: true }
const input = '今天卧推完成一组8次，重量忘了。'
const response = sets => ({ result: { strength: [{ name: '卧推', sets, note: '合成测试，不是真实训练数据', uncertain: ['重量未提供'] }], cardio: [] } })
const checks = []
const browser = await chromium.launch({ headless: true, channel: 'msedge', slowMo: Number(process.env.GYM_DEMO_SLOW_MS || 0) })
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1'))) }
async function draft(page) { return page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('gym-workout-draft-v3:')).map(k => JSON.parse(sessionStorage.getItem(k))).find(d => d.preview)) }
const firstEntry = data => Object.values(data.dayLogs)[0]?.strength[0]
async function reopen(page) { await page.reload(); await page.getByRole('button', { name: '训练', exact: true }).click() }
async function parsed(page, sets = [unknown]) {
  await page.route('**/api/parse-workout', r => r.fulfill({ json: response(sets) }))
  await page.locator('textarea').fill(input)
  await page.getByRole('button', { name: '解析', exact: true }).click()
  await page.getByText(/未保存预览/).waitFor()
}
async function confirmMissing(page) { await page.getByRole('button', { name: '确认重量未记录', exact: true }).first().click() }
async function save(page) {
  await page.getByRole('button', { name: '确认写入', exact: true }).click()
  await page.getByText('AI 训练结果已写入', { exact: true }).waitFor()
}
async function test(id, name, fn) {
  if (process.env.GYM_CASE_FILTER && !id.startsWith(process.env.GYM_CASE_FILTER)) return
  const context = await browser.newContext({ viewport: { width, height: 1024 }, timezoneId: 'Asia/Shanghai', recordVideo: { dir: out, size: { width, height: 1024 } } })
  await context.addInitScript(data => {
    if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div'); banner.textContent = 'Gym V3.2 · 合成输入 / 固定响应 · 自动化软件测试，非真人'
      Object.assign(banner.style, { position: 'fixed', top: '0', left: '0', zIndex: '100', background: '#78350f', color: 'white', fontSize: '11px', padding: '4px', width: '100%', pointerEvents: 'none' })
      document.body.append(banner)
    })
  }, fixture)
  const page = await context.newPage(); page.setDefaultTimeout(7000)
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const row = { id, name, version: 'workout-save-v3.2', kind: 'automated browser test with fixed response/fault injection, NOT real model or human test', at: new Date().toISOString(), viewport: width, modelCalls: 0, costUsd: 0, pass: false }
  const started = Date.now()
  try {
    await page.goto(process.env.GYM_TEST_URL || 'http://127.0.0.1:4173')
    await page.getByRole('button', { name: '训练', exact: true }).click()
    await fn(page, row); assert.deepEqual(errors, []); row.pass = true
    if (Number(process.env.GYM_DEMO_SLOW_MS || 0) > 0) await page.waitForTimeout(1000)
  } catch (e) { row.error = e.message }
  row.ms = Date.now() - started; row.dataAtEnd = await stored(page).catch(() => null); row.draftAtEnd = await draft(page).catch(() => null)
  row.pageErrors = errors
  await page.screenshot({ path: `${out}/${id}.png`, fullPage: true, animations: 'disabled' }).catch(e => { row.screenshotError = e.message })
  const video = page.video(); await context.close(); row.video = await video.path()
  checks.push(row); writeFileSync(`${out}/${id}.json`, JSON.stringify(row, null, 2), { flag: 'wx' })
  writeFileSync(`${out}/results.json`, JSON.stringify({ version: 'workout-save-v3.2', sourceHashes, checks, passed: checks.filter(c => c.pass).length, total: checks.length }, null, 2))
  console.log(JSON.stringify({ id, pass: row.pass, ms: row.ms, error: row.error }))
}

await test('B01', 'Unreviewed missing load blocks save and does not write 0', async page => {
  await parsed(page)
  assert.equal(await page.getByRole('button', { name: '请先检查内容', exact: true }).isDisabled(), true)
  assert.equal(firstEntry(await stored(page)), undefined)
  assert.equal((await draft(page)).preview.strength[0].sets[0].weight, null)
  assert.notEqual((await draft(page)).preview.strength[0].sets[0].missingWeightConfirmed, true)
})
await test('B02', 'Explicit missing confirmation → draft refresh → save → reopen exact values', async (page, row) => {
  await parsed(page); await confirmMissing(page); row.confirmedDraft = await draft(page)
  await reopen(page)
  assert.equal((await draft(page)).preview.strength[0].sets[0].missingWeightConfirmed, true)
  assert.equal(await page.getByRole('button', { name: '撤销缺失确认', exact: true }).count(), 1)
  await save(page); const saved = await stored(page)
  assert.deepEqual(firstEntry(saved).sets[0], { weight: null, weightState: 'unknown', reps: 8, done: true, missingWeightConfirmed: true })
  assert.equal(firstEntry(saved).estKcal, 0)
  await reopen(page); assert.deepEqual(await stored(page), saved)
  assert.equal(await page.getByRole('button', { name: '撤销缺失确认', exact: true }).count(), 1)
  await page.getByText('重量未记录 · 已确认缺失', { exact: true }).scrollIntoViewIfNeeded()
  row.confirmedSaved = saved
})
await test('B03', 'Revoking explicit missing confirmation blocks save again', async page => {
  await parsed(page); await confirmMissing(page)
  await page.getByRole('button', { name: '撤销缺失确认', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '请先检查内容', exact: true }).isDisabled(), true)
  assert.notEqual((await draft(page)).preview.strength[0].sets[0].missingWeightConfirmed, true)
  await reopen(page); assert.equal(await page.getByRole('button', { name: '确认重量未记录', exact: true }).count(), 1)
})
await test('B04', 'Replacing missing with unit-confirmed known weight clears missing marker', async page => {
  await parsed(page); await confirmMissing(page)
  await page.getByLabel('重量状态', { exact: true }).selectOption('known')
  await page.getByLabel('重量数值', { exact: true }).fill('110')
  await page.getByLabel('重量单位', { exact: true }).selectOption('jin')
  assert.equal(await page.getByRole('button', { name: '请先确认或取消重量编辑', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: '确认重量', exact: true }).click(); await save(page)
  const saved = await stored(page); const set = firstEntry(saved).sets[0]
  assert.equal(set.weight, 55); assert.equal(set.weightState, 'known'); assert.notEqual(set.missingWeightConfirmed, true)
  await reopen(page); assert.deepEqual(await stored(page), saved)
})
await test('B05', 'Confirming missing load does not silently complete a future plan', async page => {
  await parsed(page, [{ ...unknown, done: false }]); await confirmMissing(page)
  assert.equal((await draft(page)).preview.strength[0].sets[0].done, false)
  assert.equal(await page.getByRole('button', { name: '请先检查内容', exact: true }).isDisabled(), true)
  assert.equal(firstEntry(await stored(page)), undefined)
})
await test('B06', 'Storage failure retains confirmed draft and allows exact retry save', async (page, row) => {
  await parsed(page); await confirmMissing(page); const before = await stored(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem; window.restoreStorage = () => { Storage.prototype.setItem = original }
    Storage.prototype.setItem = function(k, v) { if (k === 'gym-data-v1') throw new DOMException('Storage full', 'QuotaExceededError'); return original.call(this, k, v) }
  })
  await page.getByRole('button', { name: '确认写入', exact: true }).click()
  await page.getByText('Storage full', { exact: true }).waitFor()
  assert.deepEqual(await stored(page), before); row.firstFailure = { message: 'Storage full', retainedDraft: await draft(page) }
  assert.equal(row.firstFailure.retainedDraft.preview.strength[0].sets[0].missingWeightConfirmed, true)
  await page.evaluate(() => window.restoreStorage()); await save(page)
  const saved = await stored(page); assert.equal(firstEntry(saved).sets[0].missingWeightConfirmed, true)
  await reopen(page); assert.deepEqual(await stored(page), saved)
})
await test('B07', 'Adding preview and saved sets never copies missing confirmation', async page => {
  await parsed(page); await confirmMissing(page)
  await page.getByRole('button', { name: '+ 添加一组', exact: true }).click()
  const sets = (await draft(page)).preview.strength[0].sets
  assert.equal(sets[0].missingWeightConfirmed, true); assert.notEqual(sets[1].missingWeightConfirmed, true)
  assert.equal(await page.getByRole('button', { name: '请先检查内容', exact: true }).isDisabled(), true)
  await page.locator('fieldset').getByRole('button', { name: '✕', exact: true }).last().click(); await save(page)
  await page.getByRole('button', { name: '+ 加一组', exact: true }).click()
  const saved = firstEntry(await stored(page)).sets
  assert.equal(saved[0].missingWeightConfirmed, true); assert.notEqual(saved[1].missingWeightConfirmed, true)
  assert.equal(saved[1].done, false)
})
await test('B08', 'Bulk weight apply clears missing confirmation; undo restores reviewed draft', async page => {
  await parsed(page, [known, unknown]); await confirmMissing(page)
  await page.getByRole('button', { name: '第一组重量应用到本动作全部组', exact: true }).click()
  let sets = (await draft(page)).preview.strength[0].sets
  assert.equal(sets[1].weight, 50); assert.notEqual(sets[1].missingWeightConfirmed, true)
  await page.getByRole('button', { name: '撤销批量操作（恢复操作前整份预览）', exact: true }).click()
  sets = (await draft(page)).preview.strength[0].sets
  assert.equal(sets[1].weight, null); assert.equal(sets[1].missingWeightConfirmed, true)
  await save(page); const saved = await stored(page); await reopen(page); assert.deepEqual(await stored(page), saved)
  await page.getByText('重量未记录 · 已确认缺失', { exact: true }).scrollIntoViewIfNeeded()
})
await test('B09', 'Network failure preserves missing confirmation through refresh and save', async (page, row) => {
  await parsed(page); await confirmMissing(page)
  await page.unroute('**/api/parse-workout'); await page.route('**/api/parse-workout', r => r.abort('failed'))
  await page.getByRole('button', { name: '重新解析', exact: true }).click()
  await page.getByText(/无法连接 AI/).waitFor(); row.firstFailure = { message: 'Injected network failure', retainedDraft: await draft(page) }
  await reopen(page); assert.equal(await page.locator('textarea').inputValue(), input)
  assert.equal((await draft(page)).preview.strength[0].sets[0].missingWeightConfirmed, true)
  await save(page); const saved = await stored(page); await reopen(page); assert.deepEqual(await stored(page), saved)
})
await test('B10', 'A forged model confirmation cannot enable final save', async page => {
  await parsed(page, [{ ...unknown, missingWeightConfirmed: true }])
  assert.notEqual((await draft(page)).preview.strength[0].sets[0].missingWeightConfirmed, true)
  assert.equal(await page.getByRole('button', { name: '请先检查内容', exact: true }).isDisabled(), true)
})
await test('B11', 'Mixed records show partial totals and preserve known-set calorie estimate', async page => {
  await parsed(page, [known, unknown]); await confirmMissing(page); await save(page)
  const saved = await stored(page)
  // Fixture body mass is explicit; the existing MET formula estimates only the known set.
  const bodyWeight = saved.measurements.filter(m => m.weight != null).sort((a, b) => b.date.localeCompare(a.date))[0].weight
  const expectedKcal = Math.round((5 * bodyWeight * 3 / 60) / 10) * 10
  assert.equal(firstEntry(saved).estKcal, expectedKcal)
  await page.getByText(/部分容量 400 kg·次/).waitFor()
  await page.getByText(/已完成记录中 1 组重量未记录/).waitFor()
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.getByText(/已知重量容量 400 kg·次/).waitFor()
  await page.getByText(/1 组已完成但重量未记录，未计入容量/).waitFor()
  await reopen(page); assert.deepEqual(await stored(page), saved)
})
await test('B12', 'Cancelling a new numeric edit preserves explicitly missing saved facts', async page => {
  await parsed(page); await confirmMissing(page); await save(page)
  const before = await stored(page)
  await page.getByLabel('重量状态', { exact: true }).selectOption('known')
  await page.getByLabel('重量数值', { exact: true }).fill('100')
  assert.deepEqual(await stored(page), before)
  await page.getByRole('button', { name: '取消重量编辑', exact: true }).click()
  assert.deepEqual(await stored(page), before)
  await reopen(page); assert.deepEqual(await stored(page), before)
  await page.getByText('重量未记录 · 已确认缺失', { exact: true }).waitFor()
})
await browser.close(); console.log(out)
if (checks.some(c => !c.pass)) process.exitCode = 1
