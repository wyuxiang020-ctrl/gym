import { spawnSync } from 'node:child_process'
import { build } from 'vite'

const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
await build({ envDir: false, build: { outDir: 'evals/virtual-companion/v4-poc/build' } })
