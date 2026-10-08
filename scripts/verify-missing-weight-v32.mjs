import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const out = `evals/workout-save/v3-2/verification-${Date.now()}`
mkdirSync(out, { recursive: true })
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const baseline = JSON.parse(readFileSync('evals/workout-save/v3-2/baseline.json', 'utf8'))
const env = { ...process.env, GYM_TEST_VERSION: '缺失确认 V3.2 · 2026-10-01', GYM_TEST_OUTPUT_ROOT: out }
const results = []
function run(name, command, args, extras = {}) {
  const started = Date.now()
  const r = spawnSync(command, args, { encoding: 'utf8', env: { ...env, ...extras }, timeout: 180000, maxBuffer: 8 * 1024 * 1024, shell: command === 'npm.cmd' })
  results.push({ name, exitCode: r.status, ms: Date.now() - started, stdout: r.stdout, stderr: r.stderr, error: r.error?.message })
  writeFileSync(`${out}/commands.partial.json`, JSON.stringify(results, null, 2))
  console.log(`${name}: ${r.status === 0 ? 'PASS' : 'FAIL'}`)
}
run('build', 'npm.cmd', ['run', 'build'])
run('lint', 'npm.cmd', ['run', 'lint'])
run('AI contracts (fixed fixtures)', 'npm.cmd', ['run', 'check:ai-contracts'])
run('demo safeguards (mocked)', 'npm.cmd', ['run', 'check:demo-safety'])
run('V3 storage regression (original assertions)', 'npm.cmd', ['run', 'check:workout-save'])
for (const width of ['820', '390']) {
  run(`V3 browser regression ${width} (9 scenarios)`, process.execPath, ['scripts/check-workout-browser.mjs'], { GYM_VIEWPORT_WIDTH: width })
  // Preserve the V3.1 historical script. Only redirect its output/version label, never its assertions.
  const oldScript = readFileSync('scripts/check-save-recovery-v31.mjs', 'utf8')
    .replace('`evals/workout-save/v3-1/${phase}-${Date.now()}`', '`' + out + '/regression-v31-${phase}-${Date.now()}`')
    .replace('Gym V3.1 验证', 'Gym V3.2 的 V3.1 回归')
  run(`V3.1 browser regression ${width} (7 scenarios)`, process.execPath, ['--input-type=module', '-e', oldScript], { GYM_VIEWPORT_WIDTH: width })
}
const maintainedDocs = ['docs/PROJECT_CONTEXT.md', 'docs/AI_FEATURES.md', 'docs/CHANGELOG.md', 'docs/DECISIONS.md']
const historicalChanged = Object.entries(baseline.historicalHashes).filter(([p, h]) => !maintainedDocs.includes(p) && sha(p) !== h).map(([p]) => p)
const apiChanged = Object.entries(baseline.sourceHashes).filter(([p, h]) => p.startsWith('api/') && sha(p) !== h).map(([p]) => p)
const report = {
  version: 'workout-save-v3.2', at: new Date().toISOString(), runtime: process.version,
  kind: 'automated software tests; fixed response browser regression and injected failures',
  realModelCalls: 0, modelCostUsd: 0, humanTests: 'NOT_MEASURED', authorSelfTest: 'NOT_RUN',
  results, historicalChanged, apiChanged, maintainedDocs,
  sourceHashes: Object.fromEntries([...files('src'), ...files('api')].map(p => [p, sha(p)])),
  bundleHashes: Object.fromEntries(files('dist').map(p => [p, sha(p)])),
}
writeFileSync(`${out}/verification.json`, JSON.stringify(report, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ out, commandsPassed: results.filter(r => r.exitCode === 0).length, total: results.length, historicalChanged, apiChanged }))
if (results.some(r => r.exitCode !== 0) || historicalChanged.length || apiChanged.length) process.exitCode = 1
