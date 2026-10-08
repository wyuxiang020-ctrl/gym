import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { TEACHING_VIDEOS, teachingVideoFor } from '../src/lib/teachingVideos.ts'
import { PLAN_TEMPLATES } from '../src/lib/planTemplates.ts'

const width = Number(process.env.GYM_VIEWPORT_WIDTH || 390)
const out = `evals/video-pilot/v3-3/flow-${width}-${Date.now()}`
mkdirSync(out, { recursive: true })
const sourceHashes = Object.fromEntries(['src/lib/teachingVideos.ts', 'src/components/workout/TeachingVideoPlayer.tsx', 'src/components/workout/ExerciseDetailSheet.tsx', 'src/components/workout/StrengthLogger.tsx', 'src/components/workout/WorkoutSection.tsx'].map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]))
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.dayLogs = {}; fixture.plans = []; fixture.exerciseVideos = {}
const names = PLAN_TEMPLATES.find(t => t.id === 'full-body-3day').days[0].exercises.map(e => e.name)
const results = []
function persist() { writeFileSync(`${out}/results.json`, JSON.stringify({ at: new Date().toISOString(), version: 'V3.3', kind: 'automated software; synthetic records; fixed YouTube event replay; NOT actual media/model/human test', width, modelCalls: 0, modelCostUsd: 0, sourceHashes, results }, null, 2)) }
for (const [name, run] of [
  ['U01 exact four exercise coverage', () => assert.deepEqual(TEACHING_VIDEOS.map(v => v.exercise), names)],
  ['U02 ambiguous and other variants not matched', () => { for (const n of ['卧推', '深蹲', '划船', '哑铃卧推', '史密斯深蹲', '侧平板']) assert.equal(teachingVideoFor(n), undefined, n) }],
  ['U03 unique IDs and safe source metadata', () => { assert.equal(new Set(TEACHING_VIDEOS.map(v => v.videoId)).size, 4); for (const v of TEACHING_VIDEOS) { assert.match(v.videoId, /^[\w-]{11}$/); assert.equal(new URL(v.sourceUrl).protocol, 'https:'); assert.equal(teachingVideoFor(` ${v.exercise} `), v) } }],
]) {
  const row = { name, pass: false }; const start = Date.now()
  try { run(); row.pass = true } catch (e) { row.error = e.message }
  row.ms = Date.now() - start; results.push(row); persist()
}
const { chromium } = await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH, 'index.mjs')).href)
const browser = await chromium.launch({ headless: true, channel: 'msedge', slowMo: Number(process.env.GYM_DEMO_SLOW_MS || 0) })
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('gym-data-v1')))
const log = data => Object.values(data.dayLogs)[0]
async function reopen(page) { await page.reload(); await page.getByRole('button', { name: '训练', exact: true }).click() }
async function template(page) {
  await page.getByRole('button', { name: '训练计划', exact: true }).click()
  await page.getByRole('button', { name: /^全身训练 · 新手三日 每次/ }).click()
  await page.getByRole('button', { name: '训练记录', exact: true }).click()
  await page.getByRole('button', { name: 'Day 1 · 全身 A', exact: true }).click()
}
async function test(name, run) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Asia/Shanghai', recordVideo: { dir: out, size: { width, height: 1000 } } })
  await context.addInitScript(data => {
    if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    window.YT = { Player: class {
      constructor(el, options) { this.el = el; window.__videoEvents = options.events; queueMicrotask(() => options.events.onReady()) }
      destroy() { this.el.remove() }
    } }
    document.addEventListener('DOMContentLoaded', () => {
      const b = document.createElement('div'); b.textContent = 'Gym V3.3 · 合成记录 / 播放器事件回放 · 自动化，非真人或真实视频播放'
      Object.assign(b.style, { position: 'fixed', top: '0', width: '100%', zIndex: '100', background: '#78350f', color: 'white', fontSize: '11px', pointerEvents: 'none' }); document.body.append(b)
    })
  }, fixture)
  await context.route(/https:\/\/.*youtube.*\//, route => route.fulfill({ contentType: 'text/html', body: '<html><body style="background:#171717;color:white">固定播放器回放，不是真实视频</body></html>' }))
  const page = await context.newPage(); page.setDefaultTimeout(7000)
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const row = { name, pass: false }; const start = Date.now()
  try {
    await page.goto(process.env.GYM_TEST_URL || 'http://127.0.0.1:4174'); await page.getByRole('button', { name: '训练', exact: true }).click()
    await run(page, row); assert.deepEqual(errors, []); row.pass = true
  } catch (e) { row.error = e.message }
  row.ms = Date.now() - start; row.storage = await stored(page); row.pageErrors = errors
  await page.screenshot({ path: `${out}/${name.slice(0, 3)}.png`, fullPage: true })
  const video = page.video(); await context.close(); row.recording = await video.path()
  results.push(row); persist(); console.log(JSON.stringify({ name, pass: row.pass, ms: row.ms, error: row.error }))
}
await test('F01 template → four demonstrations → 12 confirmed sets → reload', async (page, row) => {
  await template(page)
  let data = await stored(page); assert.deepEqual(log(data).strength.map(e => e.name), names)
  assert.ok(log(data).strength.every(e => e.sets.length === 3 && e.sets.every(s => s.weight === null && !s.done)))
  for (const [index, name] of names.entries()) {
    const group = page.getByRole('group', { name: `${name}训练记录`, exact: true }); const before = await stored(page)
    await group.getByRole('button', { name: '视频与要领', exact: true }).click()
    await page.getByRole('button', { name: '加载真人示范', exact: true }).click(); await page.locator('[data-video-state="ready"]').waitFor()
    await page.evaluate(() => window.__videoEvents.onStateChange({ data: 1 })); await page.locator('[data-video-state="playing"]').waitFor()
    assert.deepEqual(await stored(page), before)
    await page.getByRole('button', { name: '返回当前记录', exact: true }).click(); assert.equal(await page.locator('iframe').count(), 0)
    for (let i = 0; i < 3; i++) {
      await group.getByLabel('重量状态', { exact: true }).nth(i).selectOption(index === 3 ? 'bodyweight' : 'known')
      if (index !== 3) { await group.getByLabel('重量数值', { exact: true }).fill(String(20 + index * 5)); await group.getByRole('button', { name: '确认重量', exact: true }).click() }
      await group.getByLabel('完成', { exact: true }).nth(i).check()
    }
  }
  data = await stored(page)
  for (const [index, entry] of log(data).strength.entries()) {
    assert.equal(entry.name, names[index]); assert.equal(entry.sets.length, 3)
    for (const s of entry.sets) {
      assert.equal(s.done, true); assert.equal(s.weightState, index === 3 ? 'bodyweight' : 'known'); assert.equal(s.weight, index === 3 ? null : 20 + index * 5)
      if (index === 3) { assert.equal(s.durationSeconds, 30); assert.equal(s.reps, undefined) } else assert.equal(s.reps, 8)
    }
  }
  row.confirmed = data; await reopen(page); assert.deepEqual(await stored(page), data)
  await page.getByRole('button', { name: 'Day 1 · 全身 A', exact: true }).click(); await page.getByRole('button', { name: '跳过重复项目', exact: true }).click(); assert.deepEqual(await stored(page), data)
})
await test('F02 video failure → draft retained → save → reload', async (page, row) => {
  await template(page)
  const group = page.getByRole('group', { name: '杠铃卧推训练记录', exact: true })
  await group.getByLabel('重量状态', { exact: true }).first().selectOption('known'); await group.getByLabel('重量数值', { exact: true }).fill('42.5')
  const before = await stored(page)
  await group.getByRole('button', { name: '视频与要领', exact: true }).click()
  await page.getByRole('button', { name: '加载真人示范', exact: true }).click(); await page.locator('[data-video-state="ready"]').waitFor()
  await page.evaluate(() => window.__videoEvents.onError({ data: 150 })); await page.getByRole('alert').filter({ hasText: '发布者不允许' }).waitFor()
  row.firstFailure = { kind: 'injected embed error 150', storage: await stored(page) }; assert.deepEqual(await stored(page), before)
  await page.getByRole('button', { name: '返回当前记录', exact: true }).click()
  assert.equal(await group.getByLabel('重量数值', { exact: true }).inputValue(), '42.5')
  await group.getByRole('button', { name: '确认重量', exact: true }).click(); await group.getByLabel('完成', { exact: true }).first().check()
  const saved = await stored(page); assert.equal(log(saved).strength[1].sets[0].weight, 42.5); assert.equal(log(saved).strength[1].sets[0].done, true)
  await reopen(page); assert.deepEqual(await stored(page), saved)
})
await test('F03 ambiguous name has no automatic video match or mutation', async page => {
  await template(page)
  await page.getByPlaceholder('自定义动作名称', { exact: true }).fill('卧推'); await page.getByRole('button', { name: '添加', exact: true }).click()
  const before = await stored(page)
  await page.getByRole('group', { name: '卧推训练记录', exact: true }).getByRole('button', { name: '动作要领', exact: true }).click()
  await page.getByText(/本动作尚未匹配内置真人示范/).waitFor(); assert.equal(await page.getByRole('button', { name: '加载真人示范', exact: true }).count(), 0); assert.deepEqual(await stored(page), before)
})
await browser.close()
console.log(JSON.stringify({ out, passed: results.filter(r => r.pass).length, total: results.length }))
if (results.some(r => !r.pass)) process.exitCode = 1
