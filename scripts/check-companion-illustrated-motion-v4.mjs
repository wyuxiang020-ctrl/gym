import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const out = `evals/virtual-companion/v4-illustrated/motion-${Date.now()}`
mkdirSync(out, { recursive: true })
const { chromium } = await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ serviceWorkers: 'block' })
await context.route('**/*', r => new URL(r.request().url()).origin === 'http://127.0.0.1:4175' && !/api|companion-assets/.test(new URL(r.request().url()).pathname) ? r.continue() : r.abort())
const page = await context.newPage()
const report = { at: new Date().toISOString(), result: 'RUNNING', out }
try {
  await page.goto('http://127.0.0.1:4175/?companion-lab=1')
  report.samples = await page.evaluate(async () => {
    const { drawIllustratedPanda } = await import('/src/companion/illustratedPanda.ts')
    const { characterPose, CHARACTER_ACTIONS, blendCharacterPose } = await import('/src/companion/characterMotion.ts')
    const surface = document.createElement('canvas'); surface.width = surface.height = 600
    const c = surface.getContext('2d', { willReadFrequently: true })
    const issues = [], bounds = {}; let frames = 0
    function draw(pose, view, hat) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 600, 600)
      drawIllustratedPanda(c, pose, { view, hat })
      const alpha = c.getImageData(0, 0, 600, 600).data
      let minX = 600, minY = 600, maxX = 0, maxY = 0
      for (let y = 0; y < 600; y += 3) for (let x = 0; x < 600; x += 3) {
        if (alpha[(y * 600 + x) * 4 + 3] > 64) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
      }
      return { minX, minY, maxX, maxY }
    }
    for (const action of CHARACTER_ACTIONS) {
      let box = { minX: 600, minY: 600, maxX: 0, maxY: 0 }
      for (const view of ['front', 'three-quarter', 'side']) for (let time = 0; time <= 8000; time += 100) {
        const pose = characterPose(time, action.id)
        if (Object.values(pose.motion).some(v => !Number.isFinite(v))) issues.push(`${action.id}/${time}: nonfinite motion`)
        const b = draw(pose, view, true); frames++
        box = { minX: Math.min(box.minX, b.minX), minY: Math.min(box.minY, b.minY), maxX: Math.max(box.maxX, b.maxX), maxY: Math.max(box.maxY, b.maxY) }
        if (b.minX < 6 || b.minY < 6 || b.maxX > 594 || b.maxY > 594 || b.minX >= b.maxX) issues.push(`${action.id}/${view}/${time}: clipped or empty ${JSON.stringify(b)}`)
      }
      bounds[action.id] = box
      const first = characterPose(0, action.id), last = characterPose(8000, action.id)
      for (const side of ['left', 'right']) for (const key of ['shoulder', 'elbow']) if (Math.abs(first[side][key] - last[side][key]) > .0001) issues.push(`${action.id}: discontinuous ${side}.${key}`)
      for (const key of Object.keys(first.motion)) if (Math.abs(first.motion[key] - last.motion[key]) > .0001) issues.push(`${action.id}: discontinuous ${key}`)
      const blended = blendCharacterPose(characterPose(1550, 'hop'), characterPose(1500, action.id), .5)
      draw(blended, 'three-quarter', false)
    }
    // Mirror has no autonomous motion and must still produce a complete front drawing.
    const mirrorBounds = draw({ left: { shoulder: 2.5, elbow: .3 }, right: { shoulder: .1, elbow: 0 } }, 'front', true)
    return { frames, views: 3, stepMs: 100, bounds, mirrorBounds, issues, scope: 'Raster bounds and cycle endpoints, not a subjective quality score or real-camera test' }
  })
  assert.deepEqual(report.samples.issues, [])
  report.result = 'PASS'
} catch (error) { report.result = 'FAIL'; report.failure = String(error.stack || error) }
finally {
  await context.close(); await browser.close()
  report.source = Object.fromEntries(['illustratedPanda.ts','characterMotion.ts','PandaStage.tsx'].map(p=>[p,createHash('sha256').update(readFileSync(`src/companion/${p}`)).digest('hex')]))
  writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
}
if (report.result !== 'PASS') process.exitCode = 1
