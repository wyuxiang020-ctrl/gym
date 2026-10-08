import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const out = `evals/video-pilot/v3-3/regression-${Date.now()}`
mkdirSync(out, { recursive: true })
const results = []
const env = { ...process.env, GYM_TEST_URL: 'http://127.0.0.1:4174', GYM_TEST_VERSION: '训练示范 V3.3 · 2026-10-01', GYM_TEST_OUTPUT_ROOT: out,
  GYM_PLAYWRIGHT_PATH: 'C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright' }
function run(name, command, args, extras = {}) {
  const start = Date.now(); const result = spawnSync(command, args, { env: { ...env, ...extras }, encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024, shell: command === 'npm.cmd' })
  results.push({ name, exitCode: result.status, ms: Date.now() - start, stdout: result.stdout, stderr: result.stderr, error: result.error?.message })
  writeFileSync(`${out}/results.json`, JSON.stringify({ version: 'V3.3', kind: 'automated regression; fixed AI responses/fault injection, no real model/human test', modelCalls: 0, modelCostUsd: 0, results }, null, 2)); console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'}`)
}
function evaluated(script, replacements = [], extras = {}) {
  let code = readFileSync(script, 'utf8')
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  code = code.replaceAll("from '../", "from './").replaceAll("import('../", "import('./").replace("import './ts-test-loader.mjs'", "import './scripts/ts-test-loader.mjs'")
  run(`${script} ${extras.GYM_VIEWPORT_WIDTH || ''}`, process.execPath, ['--input-type=module', '-e', code], extras)
}
run('build', 'npm.cmd', ['run', 'build'])
run('lint', 'npm.cmd', ['run', 'lint'])
run('AI contract fixed fixtures', 'npm.cmd', ['run', 'check:ai-contracts'])
run('demo safety mocked', 'npm.cmd', ['run', 'check:demo-safety'])
run('V3 storage regression', process.execPath, ['scripts/check-workout-save.mjs'])
evaluated('scripts/check-missing-weight-v32.mjs', [["'../src/lib/'", "'./src/lib/'"], ['`${root}/deterministic-${phase}-${Date.now()}.json`', '`' + out + '/missing-weight-${phase}-${Date.now()}.json`']])
for (const width of ['390', '820']) {
  const extra = { GYM_VIEWPORT_WIDTH: width }
  run(`V3 browser ${width}`, process.execPath, ['scripts/check-workout-browser.mjs'], extra)
  evaluated('scripts/check-save-recovery-v31.mjs', [['`evals/workout-save/v3-1/${phase}-${Date.now()}`', '`' + out + '/v31-${phase}-${Date.now()}`']], extra)
  evaluated('scripts/check-missing-weight-browser-v32.mjs', [['`evals/workout-save/v3-2/browser-${width}-${Date.now()}`', '`' + out + '/v32-${width}-${Date.now()}`']], extra)
  // The new curated block has its own links. Scope the historical invalid-custom-link
  // assertion to the unchanged user collection, not unrelated licensed-source links.
  evaluated('scripts/check-exercise-resource-v32.mjs', [
    ['`evals/workout-save/v3-2/results/exercise-resource-${Date.now()}`', '`' + out + '/resource-${Date.now()}`'],
    ["page.locator('a, video').count()", "page.getByRole('region', { name: '我的教学资料', exact: true }).locator('a, video').count()"],
  ], { ...extra, GYM_RESOURCE_BROWSER: '1' })
}
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const baseline = JSON.parse(readFileSync('evals/video-pilot/v3-3/baseline.json', 'utf8'))
const maintainedDocs = ['docs/PROJECT_CONTEXT.md', 'docs/CHANGELOG.md']
const historicalChanged = Object.entries(baseline.historicalHashes).filter(([p, h]) => !maintainedDocs.includes(p) && hash(p) !== h).map(([p]) => p)
const apiChanged = Object.entries(baseline.sourceHashes).filter(([p, h]) => p.startsWith('api/') && hash(p) !== h).map(([p]) => p)
writeFileSync(`${out}/integrity.json`, JSON.stringify({ at: new Date().toISOString(), historicalChanged, apiChanged, maintainedDocs, sourceHashes: Object.fromEntries(files('src').map(p => [p, hash(p)])), bundleHashes: Object.fromEntries(files('dist').map(p => [p, hash(p)])) }, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ out, passed: results.filter(r => r.exitCode === 0).length, total: results.length, historicalChanged, apiChanged }))
if (results.some(r => r.exitCode !== 0) || historicalChanged.length || apiChanged.length) process.exitCode = 1
