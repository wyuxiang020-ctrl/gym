import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { build } from 'vite'

// Keep the first Stage 1 build and each appearance iteration as separate evidence.
const root = `evals/virtual-companion/v4-cartoon-revision/build-${Date.now()}`
mkdirSync(root, { recursive: true })
const typecheck = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { encoding: 'utf8' })
writeFileSync(`${root}/typecheck.json`, JSON.stringify({ status: typecheck.status, stdout: typecheck.stdout, stderr: typecheck.stderr }, null, 2))
if (typecheck.status !== 0) process.exit(typecheck.status ?? 1)
await build({ envDir: false, build: { outDir: `${root}/app` } })
writeFileSync(`${root}/result.json`, JSON.stringify({ at: new Date().toISOString(), typecheck: 'PASS', build: 'PASS', output: `${root}/app`, preservesInitialStage1Build: true }, null, 2))
console.log(`Cartoon revision build: ${root}/app`)
