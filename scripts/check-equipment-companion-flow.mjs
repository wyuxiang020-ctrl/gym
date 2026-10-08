import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4175'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use an isolated loopback test service')
const out = `evals/training-companion/flow-${Date.now()}`
mkdirSync(out, { recursive: true })
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
const existing = { id: 'flow-row', name: '器械划船', sets: [{ weightState: 'known', weight: 20, reps: 10, done: false }], estKcal: 0, source: 'manual' }
fixture.plans = []; fixture.exerciseVideos = {}
fixture.dayLogs = { [date]: { date, strength: [existing], cardio: [], meals: [], water: 0, checkedIn: false } }
const file = { name: 'synthetic-flow.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 120, height: 100, channels: 3, background: '#aab895' } }).png().toBuffer() }
const candidate = { equipmentId: 'seated_chest_press', confidence: 'mid', evidence: ['固定测试输出'], uncertain: '合成测试，不是真实识别。' }
const results = []
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')))
const region = page => page.getByRole('region', { name: '熊猫训练陪伴', exact: true })
const chest = page => page.getByRole('group', { name: '固定器械推胸训练记录', exact: true })
const button = (page, name) => page.getByRole('button', { name, exact: true })
async function manualAdd(page) {
  await button(page, '手动选择坐姿推胸机').click()
  await button(page, '确认是坐姿推胸机').click()
  await button(page, '添加到当前训练记录').click()
}
async function test(name, run, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(data => {
    if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    window.__camera = 0
    navigator.mediaDevices.getUserMedia = async () => { window.__camera++; throw new Error('No real camera in synthetic tests') }
  }, fixture)
  const requests = [], errors = [], row = { name, width, pass: false }
  await context.route('**/*', route => {
    const url = new URL(route.request().url()); requests.push(url.pathname)
    if (url.origin !== base) return route.abort()
    if (url.pathname === '/api/equipment-status') return route.fulfill({ json: { available: true, message: '固定测试：服务就绪' } })
    if (url.pathname === '/api/identify-equipment') return route.fulfill({ json: { result: candidate } })
    if (url.pathname.startsWith('/api/')) return route.abort()
    return route.continue()
  })
  const page = await context.newPage(); page.setDefaultTimeout(8000)
  page.on('pageerror', error => errors.push(error.message))
  try {
    await run(page, requests)
    assert.deepEqual(errors, [])
    assert.equal(await page.evaluate(() => window.__camera), 0)
    assert.ok(!requests.some(path => /pose-worker|mediapipe|\.wasm/.test(path)))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow')
    row.pass = true
  } catch (error) { row.error = error.message; process.exitCode = 1 }
  row.identifyRequests = requests.filter(path => path === '/api/identify-equipment').length
  row.errors = errors; results.push(row)
  await page.screenshot({ path: `${out}/${name.slice(0, 3)}-${width}.png` })
  writeFileSync(`${out}/results.json`, JSON.stringify({ kind: 'isolated synthetic records and photo, fixed API responses, desktop Edge at mobile viewport sizes; no live model or camera', base, modelCalls: 0, date, results }, null, 2))
  console.log(JSON.stringify(row)); await context.close()
}

for (const [index, width] of [320, 390, 1100].entries()) {
  await test(`F0${index + 1} scan confirm add target companion rest and reload`, async page => {
    await page.goto(`${base}/?equipment-scan=1`)
    await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
    await button(page, '上传并识别器械').click()
    await button(page, '确认是坐姿推胸机').click()
    await button(page, '带入训练记录 ↗').click()
    await page.getByText('从扫描页带入 · 已人工确认').waitFor()
    assert.deepEqual((await stored(page)).dayLogs[date].strength, [existing])
    await button(page, '添加到当前训练记录').click()
    const added = (await stored(page)).dayLogs[date].strength[1]
    assert.equal(added.name, '固定器械推胸'); assert.deepEqual(added.sets, [])
    await button(page, '用熊猫陪练这个动作').click()
    await region(page).waitFor()
    assert.equal(await page.getByLabel('陪练当前动作').inputValue(), added.id)
    assert.equal(await region(page).evaluate(element => element === document.activeElement), true)
    assert.equal(await button(page, '收起器械扫描').count(), 0)
    await region(page).screenshot({ path: `${out}/launch-${width}.png` })
    await button(page, '开始当前动作').click()
    await button(page, '查看当前动作记录').click()
    await chest(page).getByRole('button', { name: '+ 加一组', exact: true }).click()
    await chest(page).getByLabel('重量状态', { exact: true }).selectOption('known')
    await chest(page).getByLabel('重量数值', { exact: true }).fill('20')
    await chest(page).getByRole('button', { name: '确认重量', exact: true }).click()
    await chest(page).getByRole('checkbox', { name: '完成', exact: true }).check()
    await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
    await button(page, '结束休息').click()
    const saved = await stored(page)
    assert.deepEqual(saved.dayLogs[date].strength[0], existing)
    assert.equal(saved.dayLogs[date].strength[1].sets[0].done, true)
    await button(page, '结束本次陪练').click()
    await page.getByText('已确认 1 组；待完成 0 组。', { exact: true }).waitFor()
    assert.deepEqual(await stored(page), saved)
    await page.reload()
    assert.deepEqual(await stored(page), saved)
    assert.equal(await region(page).count(), 0)
    assert.equal(await page.evaluate(() => sessionStorage.getItem('gym-equipment-handoff-v1')), null)
  }, width)
}
await test('F04 switch existing companion and reuse exercise without duplicate', async page => {
  await page.goto(`${base}/?training-companion=1`)
  await page.getByLabel('陪练当前动作').waitFor()
  await page.getByRole('group', { name: '器械划船训练记录' }).getByRole('checkbox', { name: '完成', exact: true }).check()
  await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
  await button(page, '扫描静态器械').click(); await manualAdd(page)
  await button(page, '用熊猫陪练这个动作').click()
  await page.getByRole('heading', { name: '先核对动作与记录', exact: true }).waitFor()
  const added = (await stored(page)).dayLogs[date].strength[1]
  assert.equal(await page.getByLabel('陪练当前动作').inputValue(), added.id)
  await page.getByLabel('陪练当前动作').selectOption('flow-row')
  await button(page, '扫描静态器械').click(); await manualAdd(page)
  const before = await stored(page)
  await button(page, '用熊猫陪练这个动作').click()
  assert.equal(await page.getByLabel('陪练当前动作').inputValue(), added.id)
  assert.deepEqual(await stored(page), before)
  assert.equal(before.dayLogs[date].strength.length, 2)
})
await test('F05 failed save cannot expose companion handoff', async page => {
  await page.goto(`${base}/?equipment-training=1`)
  await button(page, '手动选择坐姿推胸机').click(); await button(page, '确认是坐姿推胸机').click()
  await page.evaluate(() => { Storage.prototype.setItem = function() { throw new DOMException('synthetic failure', 'QuotaExceededError') } })
  await button(page, '添加到当前训练记录').click()
  await page.getByText('未能添加动作，请检查训练记录或存储提示后重试。').waitFor()
  assert.equal(await button(page, '用熊猫陪练这个动作').count(), 0)
  assert.deepEqual((await stored(page)).dayLogs[date].strength, [existing])
})
await test('F06 removed target requires re-add before companion', async page => {
  await page.goto(`${base}/?equipment-training=1`); await manualAdd(page)
  // Simulate a record changed by another view while this scanner stays open.
  await page.evaluate(date => { const data = JSON.parse(localStorage.getItem('gym-data-v1')); data.dayLogs[date].strength = data.dayLogs[date].strength.filter(entry => entry.name !== '固定器械推胸'); localStorage.setItem('gym-data-v1', JSON.stringify(data)) }, date)
  await button(page, '用熊猫陪练这个动作').click()
  await page.getByText('这个动作已不在当前记录中，请重新添加后开始陪练。').waitFor()
  assert.equal(await region(page).count(), 0)
  assert.equal(await button(page, '添加到当前训练记录').isEnabled(), true)
  await button(page, '添加到当前训练记录').click()
  await button(page, '用熊猫陪练这个动作').click()
  await region(page).waitFor()
  const entries = (await stored(page)).dayLogs[date].strength
  assert.equal(entries.length, 2)
  assert.equal(await page.getByLabel('陪练当前动作').inputValue(), entries[1].id)
})
await browser.close(); console.log(out)
