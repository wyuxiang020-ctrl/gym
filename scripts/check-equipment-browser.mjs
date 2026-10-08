import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4175'
const out = `evals/equipment-scan/browser-${Date.now()}`
mkdirSync(out, { recursive: true })
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.dayLogs = {}; fixture.plans = []; fixture.exerciseVideos = {}
const pixels = await sharp({ create: { width: 120, height: 100, channels: 3, background: '#aab895' } }).png().toBuffer()
const file = { name: 'synthetic-not-equipment.png', mimeType: 'image/png', buffer: pixels }
const candidate = { equipmentId: 'seated_chest_press', confidence: 'mid', evidence: ['固定测试返回：座椅和推臂'], uncertain: '合成测试，无真实识别。' }
const results = []
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
async function test(name, run, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai' })
  const apiCalls = []; const pose = []; const errors = []
  context.on('request', request => { if (new URL(request.url()).pathname === '/api/identify-equipment') apiCalls.push('/api/identify-equipment') })
  await context.addInitScript(data => {
    if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    window.__cameraCalls = 0
    navigator.mediaDevices.getUserMedia = async () => { window.__cameraCalls++; throw new Error('No real camera in tests') }
  }, fixture)
  await context.route('**/*', route => {
    const request = route.request(); const url = new URL(request.url())
    if (url.pathname === '/api/equipment-status') return route.fulfill({ json: { available: true, accessRequired: false, message: '固定测试：接口已连接' } })
    if (url.pathname.includes('pose') || url.pathname.includes('mediapipe') || url.pathname.endsWith('.wasm')) pose.push(url.pathname)
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: '固定测试：服务暂不可用' } })
    if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) return route.abort()
    return route.continue()
  })
  const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', error => errors.push(error.message))
  const row = { name, width, pass: false }
  try {
    await page.goto(`${base}/?equipment-scan=1`)
    await page.getByRole('heading', { name: '先认清器械，再开始训练。' }).waitFor()
    await run(page, apiCalls)
    assert.equal(await page.evaluate(() => window.__cameraCalls), 0)
    assert.deepEqual(pose, []); assert.deepEqual(errors, [])
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    row.pass = true
  } catch (error) { row.error = error.message; process.exitCode = 1 }
  await page.screenshot({ path: `${out}/${name.slice(0, 3)}-${width}.png`, fullPage: true })
  row.apiCalls = apiCalls; row.poseRequests = pose; row.errors = errors; results.push(row)
  writeFileSync(`${out}/results.json`, JSON.stringify({ kind: 'isolated browser, synthetic photo and fixed responses; no live camera or model', modelCalls: 0, results }, null, 2))
  console.log(JSON.stringify(row)); await context.close()
}
await test('B01 entry and paused mirror load no camera or model', async (page, calls) => {
  assert.equal(await page.locator('.equipment-intro img').evaluate(img => img.complete && img.naturalWidth > 0), true)
  assert.equal(calls.length, 0)
  await page.goto(`${base}/?companion-lab=1&review=mirror`)
  await page.getByRole('heading', { name: '人体动作检测已暂缓。' }).waitFor()
  assert.equal(await page.getByRole('button', { name: /摄像头/ }).count(), 0)
})
await test('B02 local preview then explicit one-shot upload and human confirm', async (page, calls) => {
  let hits = 0
  await page.route('**/api/identify-equipment', route => { hits++; assert.equal(JSON.parse(route.request().postData()).mediaType, 'image/jpeg'); return route.fulfill({ json: { result: candidate } }) })
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
  await page.getByAltText('待识别的器械照片，本地预览').waitFor()
  assert.equal(calls.length, 0); assert.equal(hits, 0)
  await page.getByRole('button', { name: '上传并识别器械' }).click()
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).waitFor()
  assert.equal(hits, 1); assert.equal(await page.getByRole('link', { name: '查看官方器械介绍 ↗' }).count(), 0)
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')).dayLogs), {})
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).click()
  await page.getByRole('link', { name: '查看官方器械介绍 ↗' }).waitFor()
  await page.getByRole('button', { name: '移除照片' }).click()
  assert.equal(await page.getByRole('link', { name: '查看官方器械介绍 ↗' }).count(), 0)
}, 1100)
await test('B03 unknown rejected candidate and manual recovery', async page => {
  await page.route('**/api/identify-equipment', route => route.fulfill({ json: { result: { ...candidate, equipmentId: 'unknown', confidence: 'low', evidence: [], uncertain: '无法排除相似器械' } } }))
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
  await page.getByRole('button', { name: '上传并识别器械' }).click()
  await page.getByRole('heading', { name: '暂时无法确认' }).waitFor()
  assert.equal(await page.getByRole('button', { name: '确认是坐姿推胸机' }).count(), 0)
  await page.getByRole('button', { name: '手动选择坐姿推胸机' }).click()
  await page.getByText('手动选择 · 未经 AI 识别').waitFor()
  await page.getByRole('button', { name: '不是这类器械' }).click()
  await page.getByRole('alert').waitFor()
})
await test('B04 error preserves photo and malformed result fails closed', async page => {
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
  await page.getByRole('button', { name: '上传并识别器械' }).click()
  await page.getByText('固定测试：服务暂不可用').waitFor()
  assert.equal(await page.getByAltText('待识别的器械照片，本地预览').count(), 1)
  await page.route('**/api/identify-equipment', route => route.fulfill({ json: { result: { ...candidate, equipmentId: 'invented' } } }))
  await page.getByRole('button', { name: '上传并识别器械' }).click()
  await page.getByText('器械识别结果格式无效，请重新拍摄或手动确认。').waitFor()
})
await test('B05 cancel ignores late result and does not retry', async page => {
  let hits = 0; let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/api/identify-equipment', async route => { hits++; await gate; try { await route.fulfill({ json: { result: candidate } }) } catch {} })
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
  await page.getByRole('button', { name: '上传并识别器械' }).click()
  await page.getByRole('button', { name: '取消等待' }).click()
  release(); await page.waitForTimeout(250)
  assert.equal(hits, 1); assert.equal(await page.getByRole('button', { name: '确认是坐姿推胸机' }).count(), 0)
  assert.equal(await page.getByAltText('待识别的器械照片，本地预览').count(), 1)
})
await test('B06 manual confirmation saves empty exercise once and survives reload', async (page, calls) => {
  await page.goto(`${base}/?equipment-training=1`)
  await page.getByRole('button', { name: '手动选择坐姿推胸机' }).click()
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')).dayLogs), {})
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).click()
  await page.getByRole('button', { name: '添加到当前训练记录' }).click()
  await page.getByRole('button', { name: '已加入训练记录' }).waitFor()
  let data = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')))
  let entries = Object.values(data.dayLogs).flatMap(day => day.strength)
  assert.equal(entries.length, 1); assert.equal(entries[0].name, '固定器械推胸'); assert.deepEqual(entries[0].sets, []); assert.equal(entries[0].estKcal, 0)
  await page.reload()
  await page.getByRole('button', { name: '手动选择坐姿推胸机' }).click()
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).click()
  await page.getByRole('button', { name: '添加到当前训练记录' }).click()
  data = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')))
  entries = Object.values(data.dayLogs).flatMap(day => day.strength); assert.equal(entries.length, 1); assert.equal(calls.length, 0)
})
await test('B07 invalid file never uploads', async (page, calls) => {
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
  await page.getByRole('alert').waitFor(); assert.equal(calls.length, 0)
  assert.equal(await page.getByRole('button', { name: '上传并识别器械' }).isDisabled(), true)
})
await test('B08 scan handoff to a confirmed set survives reload', async (page, calls) => {
  await page.route('**/api/identify-equipment', route => route.fulfill({ json: { result: candidate } }))
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
  await page.getByRole('button', { name: '上传并识别器械' }).click()
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).click()
  assert.equal(await page.getByRole('button', { name: '查看该型号真人示范' }).count(), 0)
  await page.getByRole('checkbox', { name: /我已核对标牌/ }).check()
  await page.getByRole('button', { name: '查看该型号真人示范' }).click()
  assert.equal(await page.locator('iframe').count(), 0)
  await page.getByRole('button', { name: '返回器械资料' }).click()
  await page.getByRole('button', { name: '带入训练记录 ↗' }).click()
  await page.getByText('从扫描页带入 · 已人工确认').waitFor()
  assert.equal(await page.getByRole('checkbox', { name: /我已核对标牌/ }).isChecked(), true)
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')).dayLogs), {})
  await page.getByRole('button', { name: '添加到当前训练记录' }).click()
  await page.getByRole('button', { name: '开始填写组数与重量' }).click()
  await page.getByRole('button', { name: '+ 加一组', exact: true }).click()
  await page.getByLabel('重量状态', { exact: true }).selectOption('known')
  await page.getByLabel('重量数值', { exact: true }).fill('20')
  await page.getByRole('button', { name: '确认重量', exact: true }).click()
  const row = page.getByLabel('第 1 组记录方式').locator('..')
  await row.getByRole('button', { name: '+', exact: true }).click()
  await row.getByRole('button', { name: '+', exact: true }).click()
  await page.getByRole('checkbox', { name: '完成', exact: true }).check()
  await page.reload()
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')))
  const entry = Object.values(data.dayLogs).flatMap(day => day.strength)[0]
  assert.equal(entry.name, '固定器械推胸'); assert.equal(entry.sets.length, 1)
  assert.equal(entry.sets[0].weight, 20); assert.equal(entry.sets[0].reps, 10); assert.equal(entry.sets[0].done, true)
  assert.equal(await page.evaluate(() => sessionStorage.getItem('gym-equipment-handoff-v1')), null)
  assert.equal(calls.length, 1)
})
await test('B09 offline service disables upload but keeps manual path', async page => {
  await page.route('**/api/equipment-status', route => route.fulfill({ json: { available: false, message: '固定测试：服务未配置' } }))
  await page.reload(); await page.getByText('固定测试：服务未配置').waitFor()
  await page.getByLabel('选择器械照片', { exact: true }).setInputFiles(file)
  await page.getByAltText('待识别的器械照片，本地预览').waitFor()
  assert.equal(await page.getByRole('button', { name: '上传并识别器械' }).isDisabled(), true)
  await page.getByRole('button', { name: '手动选择坐姿推胸机' }).click()
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).click()
  await page.getByRole('button', { name: '带入训练记录 ↗' }).waitFor()
})
await test('B10 expired handoff is not treated as a confirmation', async page => {
  await page.evaluate(() => sessionStorage.setItem('gym-equipment-handoff-v1', JSON.stringify({ equipmentId: 'seated_chest_press', confirmedAt: Date.now() - 31 * 60000, modelMatched: true })))
  await page.goto(`${base}/?equipment-training=1`)
  await page.getByRole('button', { name: '手动选择坐姿推胸机' }).waitFor()
  assert.equal(await page.getByRole('button', { name: '添加到当前训练记录' }).count(), 0)
})
await test('B11 storage failure preserves confirmed selection', async page => {
  await page.goto(`${base}/?equipment-training=1`)
  await page.getByRole('button', { name: '手动选择坐姿推胸机' }).click()
  await page.getByRole('button', { name: '确认是坐姿推胸机' }).click()
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (this === localStorage) throw new DOMException('synthetic full storage', 'QuotaExceededError'); return original.call(this, key, value) } })
  await page.getByRole('button', { name: '添加到当前训练记录' }).click()
  await page.getByText('未能添加动作，请检查训练记录或存储提示后重试。').waitFor()
  assert.equal(await page.getByRole('button', { name: '已加入训练记录' }).count(), 0)
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')).dayLogs), {})
})
await browser.close(); console.log(out)
