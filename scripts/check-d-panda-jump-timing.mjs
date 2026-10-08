import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { ALL_CLIPS, companionClip } from '../src/companion/companionCatalog.ts'
import { librarySample, libraryPhase } from '../src/companion/libraryMotion.ts'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const output = `evals/virtual-companion/d-panda/jump-timing-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const checks = [], pass = (name, data = {}) => checks.push({ name, result: 'PASS', ...data })
const baseline = JSON.parse(readFileSync('evals/virtual-companion/d-panda/jump-timing-before/baseline.json', 'utf8'))
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
for (const before of baseline) {
  const clip = companionClip(before.id)
  assert.equal(clip.duration, before.duration * .5)
  assert.equal(hash(`public/companion-assets/d-panda/design/${clip.source}`), before.sourceHash)
  if (clip.id === 'jump') continue
  assert.equal(hash(`public/companion-assets/d-panda/${clip.texture}`), before.textureHash)
  assert.deepEqual(clip.checkpoints, before.checkpoints.map(([name, time]) => [name, time * .5]))
  for (const frame of before.samples) {
    const actual = librarySample(clip, clip.duration * frame.fraction, frame.reduced)
    assert.ok(Math.abs(actual.blink - frame.blink) < 1e-9)
    before.points.forEach(([x, y], i) => {
      const [a, b] = actual.deform(x, y), [c, d] = frame.positions[i]
      assert.ok(Math.hypot(a - c, b - d) < 1e-9, `${clip.id}: motion changed beyond retiming`)
    })
  }
}
pass('全部 23 段时长严格减半，其他 22 段素材与相同进度的运动保持一致', { durations: ALL_CLIPS.map(clip => ({ id: clip.id, before: clip.sourceDuration, after: clip.duration })) })

const jump = companionClip('jump'), distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
let episodes = 0, flying = false, maxLift = 0
for (let time = 0; time <= jump.duration; time += 5) {
  const sample = librarySample(jump, time), reduced = librarySample(jump, time, true)
  if (sample.lift > 0 && !flying) episodes++
  flying = sample.lift > 0; maxLift = Math.max(maxLift, sample.lift)
  const a = [151, 79], b = [270, 140]
  assert.ok(Math.abs(distance(sample.deform(...a), sample.deform(...b)) - distance(a, b)) < 1e-8, 'Face must stay rigid')
  assert.equal(reduced.lift, 0)
  assert.deepEqual(sample.deform(165, 339), [165, 339 - sample.lift])
}
assert.equal(episodes, 1); assert.equal(maxLift, 44)
assert.equal(librarySample(jump, 510).lift, 0); assert.equal(librarySample(jump, 990).lift, 0)
assert.equal(libraryPhase(jump, 750), '离地 · 欢呼')
assert.equal(libraryPhase(jump, 1110), '落地 · 缓冲')
pass('新小跳只有一次离地，面部完整、足底接触明确，减少动态不离地', { duration: jump.duration, takeoff: 510, apex: 750, touchdown: 990, maxLift })

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  const ready = () => page.waitForFunction(() => document.querySelector('.gentle-play')?.disabled === false)
  const seek = async time => { await page.getByRole('slider', { name: '播放进度', exact: true }).fill(String(time)); await page.waitForFunction(t => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === t, time) }
  const pixels = png => sharp(png).raw().toBuffer()
  for (const clip of ALL_CLIPS.filter(clip => clip.id !== 'jump')) {
    await page.goto(`http://127.0.0.1:4175/?companion-lab=1&clip=${clip.id}`); await ready()
    assert.equal(await page.getByRole('slider', { name: '播放进度', exact: true }).getAttribute('max'), String(clip.duration))
    await seek(clip.checkpoints[1][1])
    const actual = await pixels(await page.locator('.library-plane').screenshot({ animations: 'disabled' }))
    const expected = await pixels(`evals/virtual-companion/d-panda/library-check-1791452348445/${clip.id}-peak.png`)
    assert.ok(actual.equals(expected), `${clip.id}: unrelated visual change`)
  }
  pass('其他 22 段的峰值截图与修改前逐像素一致，进度条显示新时长')
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&clip=jump'); await ready()
  for (const time of [0, 150, 350, 510, 630, 750, 870, 990, 1110, 1480, 1650]) {
    await seek(time); await page.locator('.library-plane').screenshot({ animations: 'disabled', path: `${output}/jump-${time}.png` })
  }
  await page.getByText('仔细看看 · 逐帧与背景', { exact: true }).click()
  await page.getByRole('button', { name: '深色', exact: true }).click()
  await seek(750); await page.locator('.library-plane').screenshot({ path: `${output}/jump-dark.png` })
  await page.getByRole('button', { name: '浅色', exact: true }).click()
  await seek(0)
  const start = performance.now(); await page.locator('.gentle-play').click()
  await page.waitForFunction(() => Number(document.querySelector('.idle-canvas')?.dataset.frameTime) === 1650)
  const elapsed = performance.now() - start
  assert.ok(elapsed >= 1600 && elapsed < 2400, `Playback should take about 1.65 s, got ${elapsed}`)
  pass('新跳跃全部关键帧已保存，实际播放按 1.65 秒时间轴完成', { observedPlaybackMs: elapsed })
  assert.deepEqual(errors, [])
  await context.close()
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2)); throw error
} finally { await browser.close() }
