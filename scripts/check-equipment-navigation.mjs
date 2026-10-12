import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4186'
const out = `evals/equipment-scan/navigation-${Date.now()}`
mkdirSync(out, { recursive: true })
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const results = []
for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block', reducedMotion: width === 390 ? 'reduce' : 'no-preference' })
  await context.addInitScript(data => {
    if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(data))
    window.YT = { Player: class {
      constructor(el, options) { this.el = el; queueMicrotask(() => options.events.onReady()) }
      destroy() { this.el.remove() }
    } }
  }, fixture)
  const external = []
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== base) { external.push(url.href); return route.fulfill({ body: 'Fixed video fixture; not real playback', contentType: 'text/html' }) }
    if (url.pathname === '/api/equipment-status') return route.fulfill({ json: { available: true, message: '合成测试服务' } })
    if (url.pathname.startsWith('/api/')) return route.abort()
    return route.continue()
  })
  const page = await context.newPage(); page.setDefaultTimeout(8000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const row = { width, pass: false }
  const button = name => page.getByRole('button', { name, exact: true })
  const stored = () => page.evaluate(() => localStorage.getItem('gym-data-v1'))
  try {
    await page.goto(`${base}/?equipment-scan=1`)
    await button('01 拍摄器械').waitFor()
    const before = await stored()
    const nav = page.getByRole('navigation', { name: '器械使用步骤' })
    assert.equal(await nav.getByRole('button').count(), 4)
    for (const name of ['02 器械与动作', '03 短视频示范', '04 训练记录']) {
      await button(name).click()
      await page.getByRole('dialog', { name: '请先拍摄或选择器械' }).waitFor()
      await page.keyboard.press('Escape')
      assert.equal(await button(name).evaluate(el => document.activeElement === el), true)
      assert.equal(await button('01 拍摄器械').getAttribute('aria-current'), 'step')
    }
    await button('手动选择坐姿推胸机').click()
    await button('04 训练记录').click()
    await page.getByRole('dialog', { name: '请先确认器械与动作' }).waitFor()
    await button('知道了').click()
    const single = page.getByRole('button', { name: /^单臂推胸/ })
    await single.click(); await button('留在当前步骤').click()
    assert.equal(await single.getAttribute('aria-pressed'), 'false')
    await single.click(); await button('符合条件，选择单臂').click()
    assert.equal(await single.getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByText(/可见线索|待核对|把握较高|核对标牌/).count(), 0)
    await page.screenshot({ path: `${out}/actions-${width}.png`, fullPage: true })
    await button('确认是坐姿推胸机').click()
    const guide = page.getByRole('region', { name: '使用要点与易错提醒' })
    assert.equal(await guide.getByRole('listitem').count(), 4)
    const guideText = await guide.getByRole('list').innerText()
    assert.ok(guideText.replace(/\s/g, '').length >= 80 && guideText.replace(/\s/g, '').length <= 150)
    assert.equal(await guide.locator('.equipment-mistake').count(), 3)
    await guide.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${out}/guide-${width}.png`, fullPage: true })
    assert.equal(external.length, 0)
    await button('查看示范 · 60 秒').click()
    await page.locator('[data-video-state="ready"]').waitFor()
    assert.ok((await page.locator('iframe').getAttribute('src')).includes('jSuDZxWtDrI'))
    const clipUrl = new URL(await page.locator('iframe').getAttribute('src'))
    assert.equal(clipUrl.searchParams.get('start'), '12')
    assert.equal(clipUrl.searchParams.get('end'), '72')
    await button('04 训练记录').click()
    assert.equal(await page.locator('iframe').count(), 0)
    await button('01 拍摄器械').click()
    await page.getByRole('dialog', { name: '返回拍摄，重新选择器械？' }).waitFor()
    await page.screenshot({ path: `${out}/restart-${width}.png`, fullPage: true })
    await button('留在当前步骤').click()
    assert.equal(await button('04 训练记录').getAttribute('aria-current'), 'step')
    await button('带入训练记录 ↗').click()
    await button('添加到当前训练记录').waitFor()
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('gym-equipment-handoff-v1')).exerciseId), 'unilateral')
    assert.equal(await stored(), before)
    await button('添加到当前训练记录').click()
    await button('已加入训练记录').waitFor()
    const saved = await stored()
    const entries = Object.values(JSON.parse(saved).dayLogs).flatMap(day => day.strength)
    const entry = entries.find(item => item.name === '固定器械单臂推胸')
    assert.ok(entry); assert.deepEqual(entry.sets, [])
    await button('01 拍摄器械').click(); await button('确认返回拍摄').click()
    await button('手动选择坐姿推胸机').waitFor()
    assert.equal(await stored(), saved)
    assert.equal(await page.locator('iframe').count(), 0)
    if (width === 390) {
      await button('01 拍摄器械').hover()
      assert.equal(await page.locator('.equipment-step-label').first().evaluate(el => getComputedStyle(el).transform), 'none')
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    assert.deepEqual(errors, [])
    row.pass = true
  } catch (error) { row.error = error.message; process.exitCode = 1 }
  results.push(row); console.log(JSON.stringify(row))
  writeFileSync(`${out}/results.json`, JSON.stringify({ kind: 'Isolated records and fixed player; no real model or video', results }, null, 2))
  await context.close()
}
await browser.close(); console.log(out)
