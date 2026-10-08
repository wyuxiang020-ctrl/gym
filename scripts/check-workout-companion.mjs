import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const { startRest, pauseRest, resumeRest, remainingRest, extendRest, companionSummary } = await import('../src/lib/companionSession.ts')
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
const set = { weightState: 'known', weight: 20, reps: 10, done: false }
fixture.plans = []; fixture.exerciseVideos = {}
fixture.dayLogs = { [date]: { date, checkedIn: false, strength: [{ id: 'panda-test-chest', name: '固定器械推胸', sets: [{ ...set }, { ...set }], source: 'manual', estKcal: 0 }, { id: 'panda-test-row', name: '器械划船', sets: [{ ...set }], source: 'manual', estKcal: 0 }], cardio: [], meals: [], water: 0 } }
const out = `evals/training-companion/run-${Date.now()}`; mkdirSync(out, { recursive: true })
const results = []
function persist() { writeFileSync(`${out}/results.json`, JSON.stringify({ kind: 'isolated synthetic records; virtual clock; no model or camera', date, results }, null, 2)) }
for (const [name, run] of [
  ['U01 timer wall-clock, pause, extend and late wake', () => { let timer = startRest(60, 1000); assert.equal(remainingRest(timer, 31000), 30000); timer = pauseRest(timer, 31000); assert.equal(remainingRest(timer, 999999), 30000); timer = extendRest(timer, 999999); assert.equal(timer.remainingMs, 60000); timer = resumeRest(timer, 999999); assert.equal(remainingRest(timer, 1060000), 0) }],
  ['U02 summaries ignore incomplete and account for missing weight', () => { const entry = { ...fixture.dayLogs[date].strength[0], sets: [{ ...set, done: true }, { ...set }, { weight: null, weightState: 'unknown', missingWeightConfirmed: true, reps: 8, done: true }, { weight: null, weightState: 'not_applicable', durationSeconds: 30, done: true }] }; const before = JSON.stringify(entry); assert.deepEqual(companionSummary(entry), { completed: 3, pending: 1, volume: 200, seconds: 30, missingWeight: 1 }); assert.equal(JSON.stringify(entry), before) }],
]) { const row = { name, pass: false }; try { run(); row.pass = true } catch (error) { row.error = error.message; process.exitCode = 1 } results.push(row); persist() }
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const base = 'http://127.0.0.1:4175'
async function test(name, run, { width = 390, data = fixture, webgl = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Shanghai', serviceWorkers: 'block' })
  const requests = [], errors = []
  await context.addInitScript(({ data, webgl }) => {
    if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    window.__camera = 0; navigator.mediaDevices.getUserMedia = async () => { window.__camera++; throw new Error('blocked') }
    if (!webgl) { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(kind, ...args) { return kind === 'webgl' ? null : original.call(this, kind, ...args) } }
  }, { data, webgl })
  await context.route('**/*', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname)
    if (url.origin !== base || url.pathname.startsWith('/api/')) return route.abort()
    return route.continue()
  })
  const page = await context.newPage(); page.setDefaultTimeout(7000); page.on('pageerror', error => errors.push(error.message))
  const row = { name, width, pass: false }
  try {
    await page.goto(`${base}/?training-companion=1`)
    await page.getByRole('heading', { name: '先核对动作与记录' }).waitFor()
    await run(page)
    assert.equal(await page.evaluate(() => window.__camera), 0)
    assert.deepEqual(errors, []); assert.ok(!requests.some(url => /pose-worker|mediapipe|\.wasm|\/api\//.test(url)))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    row.pass = true
  } catch (error) { row.error = error.message; process.exitCode = 1 }
  const panel = page.getByRole('region', { name: '熊猫训练陪伴' })
  if (await panel.count()) await panel.screenshot({ path: `${out}/${name.slice(0, 3)}.png` })
  else await page.screenshot({ path: `${out}/${name.slice(0, 3)}.png` })
  row.errors = errors; results.push(row); persist(); console.log(JSON.stringify(row)); await context.close()
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')))
const done = page => page.getByRole('group', { name: '固定器械推胸训练记录', exact: true }).getByRole('checkbox', { name: '完成', exact: true })
await test('B01 start and finish never manufacture completed sets', async page => {
  const before = await stored(page)
  await page.getByRole('button', { name: '开始当前动作', exact: true }).click()
  await page.getByRole('button', { name: '结束本次陪练', exact: true }).click()
  await page.getByText('已确认 0 组；待完成 2 组。', { exact: true }).waitFor()
  assert.deepEqual(await stored(page), before)
})
await test('B02 saved completion rest pause resume expiry manual next', async page => {
  await page.clock.install()
  await page.getByLabel('休息时长', { exact: true }).selectOption('30')
  await done(page).first().check()
  await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  await page.getByRole('button', { name: '暂停计时', exact: true }).click()
  const remaining = await page.getByLabel('休息剩余时间', { exact: true }).textContent()
  await page.clock.fastForward(40000)
  assert.equal(await page.getByLabel('休息剩余时间', { exact: true }).textContent(), remaining)
  await page.getByRole('button', { name: '延长 30 秒', exact: true }).click()
  await page.getByRole('button', { name: '继续计时', exact: true }).click()
  await page.clock.fastForward(65000)
  await page.getByRole('heading', { name: '准备好了再继续', exact: true }).waitFor()
  const data = await stored(page); assert.equal(data.dayLogs[date].strength[0].sets.filter(set => set.done).length, 1)
  await page.getByRole('button', { name: '准备下一组', exact: true }).click()
  assert.deepEqual(await stored(page), data)
  await page.reload(); await page.getByRole('heading', { name: '先核对动作与记录' }).waitFor()
  assert.deepEqual(await stored(page), data)
})
await test('B03 failed save produces no completion reaction', async page => {
  const before = await stored(page)
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (this === localStorage) throw new DOMException('synthetic full storage', 'QuotaExceededError'); original.call(this, key, value) } })
  await done(page).first().click()
  assert.equal(await done(page).first().isChecked(), false)
  assert.equal(await page.locator('[data-session-phase]').getAttribute('data-session-phase'), 'ready')
  assert.deepEqual(await stored(page), before)
})
await test('B04 undo switch and close reset active rest', async page => {
  await done(page).first().check(); await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  await done(page).first().uncheck(); await page.getByText('完成记录已调整，请核对后继续。').waitFor()
  await done(page).first().check(); await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  await page.getByLabel('陪练当前动作', { exact: true }).selectOption('panda-test-row')
  assert.equal(await page.locator('[data-session-phase]').getAttribute('data-session-phase'), 'ready')
  await page.getByRole('button', { name: '关闭陪练', exact: true }).click()
  assert.equal(await page.locator('.workout-companion').count(), 0)
  await page.getByRole('button', { name: '开启熊猫陪练', exact: true }).click()
  await page.getByRole('heading', { name: '先核对动作与记录' }).waitFor()
})
await test('B05 late visible tab expires by deadline without more writes', async page => {
  await page.clock.install(); await page.getByLabel('休息时长').selectOption('30')
  await done(page).first().check(); await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  const before = await stored(page)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.clock.fastForward(45000)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.getByRole('heading', { name: '准备好了再继续', exact: true }).waitFor()
  assert.deepEqual(await stored(page), before)
})
await test('B06 WebGL fallback keeps timer and confirmation usable', async page => {
  await page.getByAltText('D 熊猫原画形象', { exact: true }).waitFor()
  await done(page).first().check(); await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  await page.getByRole('checkbox', { name: '静态形象', exact: true }).check()
  assert.equal(await page.locator('.workout-panda-art canvas').count(), 0)
}, { webgl: false, width: 820 })
await test('B07 completed summary respects known missing and timed records', async page => {
  await page.getByRole('button', { name: '结束本次陪练', exact: true }).click()
  await page.getByText('已确认 3 组；待完成 1 组。', { exact: true }).waitFor()
  await page.getByText('已知重量的次数型容量：200 kg·次').waitFor()
  await page.getByText('已确认计时组：30 秒').waitFor()
  await page.getByText('1 组已确认重量缺失，容量不包含这些组。').waitFor()
}, { data: { ...fixture, dayLogs: { [date]: { ...fixture.dayLogs[date], strength: [{ ...fixture.dayLogs[date].strength[0], sets: [{ ...set, done: true }, { ...set }, { weight: null, weightState: 'unknown', missingWeightConfirmed: true, reps: 8, done: true }, { weight: null, weightState: 'not_applicable', durationSeconds: 30, done: true }] }] } } } })
await test('B08 pause after deadline cannot leave a frozen zero timer', async page => {
  await page.clock.install(); await page.getByLabel('休息时长').selectOption('30')
  await done(page).first().check(); await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  const before = await stored(page)
  // Jump wall time without firing the interval to reproduce a delayed event loop.
  await page.clock.setSystemTime(new Date(await page.evaluate(() => Date.now()) + 31000))
  await page.getByRole('button', { name: '暂停计时', exact: true }).click()
  await page.getByRole('heading', { name: '准备好了再继续', exact: true }).waitFor()
  assert.equal(await page.getByLabel('休息剩余时间').count(), 0)
  assert.deepEqual(await stored(page), before)
})
await browser.close(); console.log(out)
