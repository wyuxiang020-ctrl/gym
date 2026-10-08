import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.argv[2]
if (!root?.startsWith('evals/virtual-companion/v4-phase0/run-') || !readFileSync(`${root}/baseline.json`, 'utf8')) throw new Error('Expected an existing phase 0 baseline')
const retryFailed = process.argv[3] === 'retry-failed'
const failedNames = retryFailed ? JSON.parse(readFileSync(`${root}/checks/results.json`, 'utf8')).results.filter(r => r.exitCode !== 0).map(r => r.name) : null
const out = `${root}/${retryFailed ? `checks-retry-${Date.now()}` : 'checks'}`
mkdirSync(out, { recursive: true })
// Children receive system paths only, never inherited application credentials.
const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT', 'SystemDrive'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]))
Object.assign(env, { GYM_TEST_VERSION: 'V4 phase 0 baseline verification', GYM_TEST_OUTPUT_ROOT: `${out}/storage`, NO_COLOR: '1' })
Object.assign(env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: resolve('.').replaceAll('\\', '/') })
const results = []
function run(name, args) {
  if (failedNames && !failedNames.includes(name)) return
  const t = Date.now()
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
  results.push({ name, args, exitCode: result.status, ms: Date.now() - t, stdout: result.stdout, stderr: result.stderr, error: result.error?.message })
  writeFileSync(`${out}/results.json`, JSON.stringify({ at: new Date().toISOString(), kind: 'Current-source offline software checks; synthetic storage and fixed validation fixtures; no browser, human, camera, or cloud model test', realModelCalls: 0, modelCostUsd: 0, results }, null, 2))
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (${Date.now() - t} ms)`)
  if (result.status !== 0) console.log(result.stderr || result.stdout || result.error?.message)
}
run('TypeScript app', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--noEmit', '--incremental', '--tsBuildInfoFile', `${out}/app.tsbuildinfo`])
run('TypeScript Vite config', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json', '--noEmit', '--incremental', '--tsBuildInfoFile', `${out}/node.tsbuildinfo`])
const oxlint = JSON.parse(readFileSync('node_modules/oxlint/package.json', 'utf8')).bin.oxlint
run('Lint product, API, scripts and Vite config', [`node_modules/oxlint/${oxlint}`, 'src', 'api', 'scripts', 'vite.config.ts'])
run('AI contract fixed fixtures (no model)', ['--experimental-strip-types', 'scripts/check-ai-contracts.mjs'])
run('Storage deterministic fixtures (in-memory)', ['scripts/check-workout-save.mjs'])
// Do not load .env files or replace the existing dist directory.
run('Isolated Vite/PWA build with env files disabled', ['--input-type=module', '-e', `import {build} from 'vite'; await build(${JSON.stringify({ envFile: false, build: { outDir: resolve(out, 'build') }, logLevel: 'info' })});`])
console.log(JSON.stringify({ out, passed: results.filter(x => x.exitCode === 0).length, total: results.length }))
if (results.some(x => x.exitCode !== 0)) process.exitCode = 1
