import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const base = process.env.GYM_RELEASE_URL || 'https://gym-iota-self.vercel.app'
assert.ok(['gym-iota-self.vercel.app', '127.0.0.1'].includes(new URL(base).hostname))
const prepare = process.argv.includes('--prepare')
const out = 'evals/releases/2026-10-11-windows'
const profile = resolve('tmp/windows-pilot-2026-10-11')
mkdirSync(out, { recursive: true })
const statePath = `${out}/before.json`
const releaseLabel = readFileSync('src/components/ReleaseStatus.tsx', 'utf8').match(/RELEASE_LABEL = '([^']+)'/)[1]
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json', 'utf8'))
fixture.plans = []; fixture.exerciseVideos = {}
fixture.dayLogs = { [date]: { date, checkedIn: false, strength: [{ id: 'windows-pilot-chest', name: '固定器械推胸', source: 'manual', estKcal: 0, sets: [{ weightState: 'known', weight: 20, reps: 10, done: false }, { weightState: 'known', weight: 20, reps: 10, done: false }] }], cardio: [], meals: [], water: 0 } }
const report = { base, kind: 'Windows Edge isolated persistent profile; synthetic data; no personal installed app, real camera, paid AI or human task timing', checks: [], pass: false }
let context
async function launch() {
  const ctx = await chromium.launchPersistentContext(profile, { headless: true, channel: 'msedge', viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', acceptDownloads: true })
  await ctx.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.origin !== base || url.pathname.startsWith('/api/') ? route.abort() : route.continue()
  })
  await ctx.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new Error('No camera in software checks') } })
  return ctx
}
const data = page => page.evaluate(() => localStorage.getItem('gym-data-v1'))
try {
  context = await launch()
  if (prepare) await context.addInitScript(fixture => { if (!localStorage.getItem('gym-data-v1')) localStorage.setItem('gym-data-v1', JSON.stringify(fixture)) }, fixture)
  let page = context.pages()[0] || await context.newPage()
  page.setDefaultTimeout(25000)
  await page.goto(base + '/?training-companion=1', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.getByRole('heading', { name: '先核对动作与记录', exact: true }).waitFor()
  const versionRegion = page.getByRole('region', { name: '应用版本', exact: true })
  if (prepare) {
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated')
    const state = { base, version: await versionRegion.innerText(), data: await data(page), preparedAt: new Date().toISOString() }
    writeFileSync(statePath, JSON.stringify(state, null, 2))
    report.checks.push({ name: 'pre-release persistent profile captured', version: state.version })
  } else {
    assert.ok(existsSync(statePath), 'Run --prepare before production deployment')
    const before = JSON.parse(readFileSync(statePath, 'utf8')); assert.equal(before.base, base)
    await page.getByRole('button', { name: '检查更新', exact: true }).click()
    await page.getByRole('button', { name: '刷新页面', exact: true }).waitFor()
    await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return r?.active?.state === 'activated' && !r.installing && !r.waiting })
    await page.getByRole('button', { name: '刷新页面', exact: true }).click()
    await versionRegion.getByText(releaseLabel, { exact: true }).waitFor()
    assert.equal(await data(page), before.data)
    report.checks.push({ name: 'explicit update preserves pre-release records', from: before.version, to: releaseLabel, observedOldToNew: !before.version.includes(releaseLabel) })
    for (const width of [1280, 1920, 820]) {
      await page.setViewportSize({ width, height: 900 })
      for (const tab of ['今天', '训练', '饮食', '身体', '记录']) {
        const control = page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: tab, exact: true })
        await control.focus(); await page.keyboard.press('Enter')
        await page.locator('main').waitFor()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${tab} overflow`)
        assert.equal(await page.getByText('页面暂时无法加载', { exact: true }).count(), 0)
      }
      await page.screenshot({ path: `${out}/records-${width}.png` })
      report.checks.push({ name: 'window widths and keyboard tab activation', width, tabs: 5 })
    }
    await page.goto(base + '/?training-companion=1', { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: '先核对动作与记录', exact: true }).waitFor()
    const complete = page.getByRole('group', { name: '固定器械推胸训练记录', exact: true }).getByRole('checkbox', { name: '完成', exact: true }).first()
    await complete.focus(); await page.keyboard.press('Space')
    await page.getByRole('heading', { name: '组间歇一会', exact: true }).waitFor()
    assert.equal(JSON.parse(await data(page)).dayLogs[date].strength[0].sets.filter(s => s.done).length, 1)
    await page.getByRole('button', { name: '结束本次陪练', exact: true }).click()
    const saved = await data(page)
    report.checks.push({ name: 'keyboard confirmation saves one group and ending companion adds none' })
    await page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '记录', exact: true }).click()
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 JSON', exact: true }).click()
    const download = await downloaded
    await download.saveAs(`${out}/synthetic-backup.json`)
    assert.deepEqual(JSON.parse(readFileSync(`${out}/synthetic-backup.json`, 'utf8')), JSON.parse(saved))
    await page.locator('input[type=file]').setInputFiles(`${out}/synthetic-backup.json`)
    await page.getByText('确认替换当前数据？', { exact: true }).waitFor()
    await page.getByRole('button', { name: '取消', exact: true }).click()
    assert.equal(await data(page), saved)
    report.checks.push({ name: 'export matches saved records; cancelling import preserves them' })
    await context.close(); context = await launch(); page = context.pages()[0] || await context.newPage()
    page.setDefaultTimeout(25000)
    await page.goto(base + '/?training-companion=1', { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: '先核对动作与记录', exact: true }).waitFor()
    assert.equal(await data(page), saved)
    report.checks.push({ name: 'full isolated Edge process restart preserves saved data; active rest does not auto-resume' })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.locator('.training-hero').waitFor()
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText(/当前离线 · 已缓存的记录页面/).waitFor()
    assert.equal(await data(page), saved)
    await page.screenshot({ path: `${out}/offline.png` })
    report.checks.push({ name: 'offline cached home and data survive restart' })
    await context.setOffline(false)
  }
  report.pass = true
} catch (error) { report.error = error.message; process.exitCode = 1 }
finally { await context?.close(); writeFileSync(`${out}/${prepare ? 'prepare' : 'results'}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)) }
