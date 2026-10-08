import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = `evals/virtual-companion/v4-poc/regression-${Date.now()}`
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4175'
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Only a loopback test service is allowed')
mkdirSync(root, { recursive: true })
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`])
const historicalPaths = [
  'scripts/check-ai-contracts.mjs', 'scripts/check-workout-save.mjs',
  'scripts/check-workout-browser.mjs', 'scripts/check-teaching-player-v33.mjs', 'scripts/check-video-flow-v33.mjs',
  ...files('evals/workout-save'), ...files('evals/video-pilot'),
]
const beforeHashes = Object.fromEntries(historicalPaths.map(path => [path, sha(path)]))
const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT', 'SystemDrive'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]))
Object.assign(env, {
  GYM_TEST_URL: base,
  GYM_TEST_VERSION: '虚拟训练伙伴 V4 POC · 既有功能纯回放回归',
  GYM_PLAYWRIGHT_PATH: process.env.GYM_PLAYWRIGHT_PATH || 'C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  GYM_BROWSER_CHANNEL: 'msedge', NO_COLOR: '1',
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: resolve('.').replaceAll('\\', '/'),
})
const results = []
const startedAt = new Date().toISOString()
const report = () => ({
  version: 'virtual-companion-v4-poc', startedAt, base,
  evidenceType: 'Existing software regression suites; isolated Edge browser profiles at desktop window widths 390/820; fixed API/YouTube events and fault injection only. Not real video playback, human tasks, real cameras, phone hardware or model quality tests.',
  cloudModelCalls: 0, cameraCalls: 0, liveVideoRequests: 0,
  networkPolicy: 'Injected context policy blocks all external network and unmocked /api/ requests before navigation. Existing later YouTube/API replay routes can fulfill locally. Service workers blocked. getUserMedia always rejected before application code.',
  inMemoryAdaptations: ['New V4 output directories', 'Root-relative eval import resolution for old flow script', 'Network/camera guards injected before browser creation; existing assertions and scenarios unchanged'],
  originalScriptHashes: Object.fromEntries(historicalPaths.filter(path => path.startsWith('scripts/')).map(path => [path, beforeHashes[path]])),
  results,
})
function persist() { writeFileSync(`${root}/results.json`, JSON.stringify(report(), null, 2)) }
function run(name, args, extras = {}) {
  const began = Date.now()
  const result = spawnSync(process.execPath, args, { cwd: resolve('.'), env: { ...env, ...extras }, encoding: 'utf8', timeout: 240_000, maxBuffer: 12 * 1024 * 1024, windowsHide: true })
  const row = { name, exitCode: result.status, ms: Date.now() - began, stdout: result.stdout, stderr: result.stderr, error: result.error?.message }
  results.push(row)
  persist()
  console.log(JSON.stringify({ name, exitCode: row.exitCode, ms: row.ms, error: row.error }))
  if (row.exitCode !== 0) console.log(row.stderr || row.stdout)
}

// This wrapper changes test infrastructure only. It cannot access a user's
// persistent browser profile and cannot pass camera permission to the hardware.
const networkGuard = `
const v4NetworkAudit = [];
const v4Launch = chromium.launch.bind(chromium);
chromium.launch = async options => {
  const browser = await v4Launch(options);
  const createContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await createContext({ ...options, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(process.env.GYM_TEST_URL).origin && !url.pathname.startsWith('/api/')) return route.continue();
      v4NetworkAudit.push({ url: url.href, action: 'blocked before network' });
      return route.abort('blockedbyclient');
    });
    await context.addInitScript(() => {
      const deny = () => Promise.reject(new DOMException('V4 regression policy: physical camera disabled', 'NotAllowedError'));
      if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true });
      else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: deny }, configurable: true });
    });
    return context;
  };
  return browser;
};
process.once('exit', () => writeFileSync(out + '/v4-network-policy.json', JSON.stringify({ policy: 'No physical camera, external network or unmocked API; explicit fixed playback/API routes remain local fulfillments', blocked: v4NetworkAudit }, null, 2)));
`

function evaluated(script, kind, width) {
  let code = readFileSync(script, 'utf8')
  if (kind === 'player' || kind === 'flow') {
    const original = `\`evals/video-pilot/v3-3/${kind}-\${width}-\${Date.now()}\``
    assert.ok(code.includes(original), `Expected old ${kind} output expression`)
    code = code.replace(original, JSON.stringify(`${root}/${kind}-${width}`))
  }
  // Eval's parent URL is the repository root, not scripts/.
  code = code.replaceAll("from '../src/", "from './src/")
  const launch = /const browser\s*=\s*await chromium\.launch/
  assert.ok(launch.test(code), `Expected browser creation in ${script}`)
  code = code.replace(launch, match => networkGuard + '\n' + match)
  run(`${kind}-${width}`, ['--experimental-strip-types', '--input-type=module', '--eval', code], {
    GYM_VIEWPORT_WIDTH: String(width), GYM_TEST_OUTPUT_ROOT: `${root}/${kind}-${width}`,
  })
}

run('contracts-18-fixed-fixtures', ['--experimental-strip-types', 'scripts/check-ai-contracts.mjs'])
run('storage-18-in-memory-fixtures', ['scripts/check-workout-save.mjs'], { GYM_TEST_OUTPUT_ROOT: `${root}/storage` })
for (const width of [390, 820]) {
  evaluated('scripts/check-workout-browser.mjs', 'workout', width)
  evaluated('scripts/check-teaching-player-v33.mjs', 'player', width)
  evaluated('scripts/check-video-flow-v33.mjs', 'flow', width)
}
const changed = Object.entries(beforeHashes).filter(([path, hash]) => sha(path) !== hash).map(([path]) => path)
writeFileSync(`${root}/historical-integrity.json`, JSON.stringify({ at: new Date().toISOString(), checkedFiles: historicalPaths.length, changed, originalHashes: beforeHashes }, null, 2))
console.log(JSON.stringify({ output: root, passed: results.filter(result => result.exitCode === 0).length, total: results.length, historicalChanged: changed }))
if (results.some(result => result.exitCode !== 0) || changed.length) process.exitCode = 1
