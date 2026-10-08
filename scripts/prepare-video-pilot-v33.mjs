import { readdirSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'

const root = 'evals/video-pilot/v3-3'
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const sources = [...files('src'), ...files('api'), 'package.json', 'vite.config.ts']
const history = [...files('docs'), ...files('evals/workout-save')]
mkdirSync(root, { recursive: true })
writeFileSync(`${root}/baseline.json`, JSON.stringify({
  version: 'video-pilot-v3.3', at: new Date().toISOString(), scope: 'Existing full-body-3day Day 1: four exercises, no new training prescription',
  sourceHashes: Object.fromEntries(sources.map(p => [p, sha(p)])),
  historicalHashes: Object.fromEntries(history.map(p => [p, sha(p)])),
  realModelCalls: 0, modelCostUsd: 0,
}, null, 2), { flag: 'wx' })
for (const file of sources) {
  const destination = `${root}/baseline-source/${file}`
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(file, destination)
}
console.log(JSON.stringify({ baseline: `${root}/baseline.json`, sources: sources.length, history: history.length }))
