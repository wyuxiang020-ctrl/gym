import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { build } from 'vite'
const root = `evals/virtual-companion/d-panda/build-${Date.now()}`
mkdirSync(root, { recursive: true })
const checked = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { encoding: 'utf8' })
writeFileSync(`${root}/typecheck.json`, JSON.stringify({ status: checked.status, stdout: checked.stdout, stderr: checked.stderr }, null, 2))
if (checked.status !== 0) process.exit(checked.status ?? 1)
await build({ envDir: false, build: { outDir: `${root}/app` } })
writeFileSync(`${root}/result.json`, JSON.stringify({ at: new Date().toISOString(), typecheck: 'PASS', build: 'PASS', output: `${root}/app` }, null, 2))
console.log(`D Panda build: ${root}/app`)
