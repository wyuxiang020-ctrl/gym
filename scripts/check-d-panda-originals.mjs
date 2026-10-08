import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { ORIGINAL_BOARDS, ORIGINAL_POSES, originalBoard } from '../src/companion/originals.ts'

const output = `evals/virtual-companion/d-panda/originals-check-${Date.now()}`
mkdirSync(output, { recursive: true })
const sourceRoot = 'docs/virtual-companion-v4/panda-ip-handoff-2026-10-08'
const publicRoot = 'public/companion-assets/d-panda/design'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const checks = []
const manifest = JSON.parse(readFileSync(`${sourceRoot}/MANIFEST.json`, 'utf8'))
for (const file of manifest.files) assert.equal(hash(readFileSync(`${sourceRoot}/${file.path}`)), file.sha256, file.path)
checks.push({ name: '交付包原文件完整性', files: manifest.files.length, result: 'PASS' })
for (const board of ORIGINAL_BOARDS) assert.equal(hash(readFileSync(`${sourceRoot}/assets/${board.file}`)), hash(readFileSync(`${publicRoot}/${board.file}`)), board.file)
checks.push({ name: '七张运行原图与交付包逐字节一致', result: 'PASS' })

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  const loaded = [], errors = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    loaded.push(url.pathname)
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') ? route.continue() : route.abort()
  })
  await context.addInitScript(() => {
    window.__originalCameraCalls = 0
    navigator.mediaDevices.getUserMedia = async () => { window.__originalCameraCalls++; throw new Error('Camera is outside this task') }
    window.__originalStorageWrites = 0
    Storage.prototype.setItem = () => { window.__originalStorageWrites++; throw new Error('Storage writes are outside this task') }
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=originals')
  await page.locator('[data-version="D-originals"]').waitFor()
  await page.getByRole('button', { name: '原始尺寸 1:1', exact: true }).click()
  for (const pose of ORIGINAL_POSES) {
    await page.locator(`[data-pose-choice="${pose.id}"]`).click()
    const board = originalBoard(pose.board)
    await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode() }, `/companion-assets/d-panda/design/${board.file}`)
    const art = page.locator('.original-art')
    assert.equal(await art.getAttribute('data-source'), board.file)
    const [left, top, width, height] = pose.rect
    const screenshot = await art.screenshot({ path: `${output}/${pose.id}.png` })
    const actual = await sharp(screenshot).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const expected = await sharp(`${sourceRoot}/assets/${board.file}`).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer()
    assert.equal(actual.info.width, width)
    assert.equal(actual.info.height, height)
    let differentPixels = 0
    for (let i = 0; i < expected.length; i += 4) {
      if (actual.data[i] !== expected[i] || actual.data[i + 1] !== expected[i + 1] || actual.data[i + 2] !== expected[i + 2] || actual.data[i + 3] !== expected[i + 3]) differentPixels++
    }
    checks.push({ name: `原尺寸像素核对 · ${pose.label}`, differentPixels, pixels: width * height, result: differentPixels === 0 ? 'PASS' : 'FAIL' })
    assert.equal(differentPixels, 0, `${pose.id}: source pixels changed`)
  }
  await page.getByRole('button', { name: '适应画面', exact: true }).click()
  for (const board of ORIGINAL_BOARDS) {
    await page.locator(`[data-board-choice="${board.id}"]`).click()
    assert.equal(await page.locator('.original-art').getAttribute('viewBox'), '0 0 1536 1024')
    assert.equal(await page.locator('.original-art image').getAttribute('href'), `/companion-assets/d-panda/design/${board.file}`)
    const response = await context.request.get(`http://127.0.0.1:4175/companion-assets/d-panda/design/${board.file}`)
    assert.equal(response.status(), 200)
    assert.equal(hash(await response.body()), hash(readFileSync(`${sourceRoot}/assets/${board.file}`)))
  }
  checks.push({ name: '全部七张设计板可切换，HTTP 图片响应保持原字节', result: 'PASS' })
  await page.locator('[data-pose-choice="stand"]').click()
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.locator('[data-pose-choice="high"]').click()
  await page.screenshot({ path: `${output}/mobile-raise.png`, fullPage: true })
  assert.equal(await page.locator('canvas,video').count(), 0)
  assert.equal(await page.evaluate(() => window.__originalCameraCalls), 0)
  assert.equal(await page.evaluate(() => window.__originalStorageWrites), 0)
  assert.deepEqual(loaded.filter(path => /\/dpanda\/|\/mirror\/|PandaStage|\.wasm$|pose_landmarker/.test(path)), [])
  assert.deepEqual(errors, [])
  checks.push({ name: '手机宽度无横向溢出；旧绘制、镜像与相机未加载；无存储写入或脚本错误', result: 'PASS' })
  await page.route('**/companion-assets/d-panda/design/*.png', route => route.abort())
  await page.reload()
  await page.getByRole('alert').filter({ hasText: '原图暂时无法加载' }).waitFor()
  checks.push({ name: '原图加载失败明确提示', result: 'PASS' })
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'PASS', output, checks }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', output, checks }, null, 2))
} catch (error) {
  writeFileSync(`${output}/result.json`, JSON.stringify({ status: 'FAIL', output, checks, error: String(error) }, null, 2))
  throw error
} finally {
  await browser.close()
}
