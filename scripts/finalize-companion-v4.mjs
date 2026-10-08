import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// Read-only inventory apart from this stage's delivery index. No env, personal
// browser data, Git state, or historical result is read or rewritten here.
const root = resolve('.')
const evalRoot = 'evals/virtual-companion/v4-poc'
const docRoot = 'docs/virtual-companion-v4'
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  const child = `${path}/${entry.name}`
  return entry.isDirectory() ? walk(child) : [child]
})
const records = paths => Object.fromEntries([...new Set(paths)].sort().map(path => {
  if (!existsSync(path)) throw new Error(`Missing artifact: ${path}`)
  return [path, { bytes: statSync(path).size, sha256: hash(path) }]
}))
const baseline = readJson(`${evalRoot}/baseline.json`)
const sourceFiles = [
  ...Object.keys(baseline.sourceHashes), ...walk('src/companion'),
  'src/EntryRouter.tsx', 'src/EntryBoundary.tsx', 'public/companion-assets/pose-worker.js',
  ...readdirSync('scripts').filter(name => name.includes('companion') && name.endsWith('v4.mjs')).map(name => `scripts/${name}`),
]
const docs = ['STAGE-1-DELIVERY.md', 'IMPLEMENTATION-NOTES.md', 'STAGE-1-BUILD-PROMPT.md'].map(file => `${docRoot}/${file}`)
const missingLinks = []
for (const doc of docs.slice(0, 2)) {
  for (const match of readFileSync(doc, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(match[1]) || match[1] === 'ARTIFACTS-PHASE1.json') continue
    if (!existsSync(resolve(dirname(doc), match[1]))) missingLinks.push({ doc, target: match[1] })
  }
}
if (missingLinks.length) throw new Error(JSON.stringify({ missingLinks }))
const evidence = walk(evalRoot).filter(path => !path.includes('/baseline-source/') && !path.includes('/build/'))
  .filter(path => /\.(json|log|png|webm|mjs|md)$/.test(path))
const index = {
  version: 'virtual-companion-v4-poc', at: new Date().toISOString(), timezone: 'Asia/Shanghai',
  localEntry: 'http://127.0.0.1:4175/?companion-lab=1',
  startup: 'npm run dev:companion', build: 'npm run build:companion',
  baseline: `${evalRoot}/baseline.json`, baselineSha256: hash(`${evalRoot}/baseline.json`),
  sourceHashes: records(sourceFiles), assetHashes: records(walk('public/companion-assets')),
  buildHashes: records(walk(`${evalRoot}/build`)),
  documentHashes: records([...docs, ...walk(`${docRoot}/actual-render`),
    `${docRoot}/character-direction/J-pixel-reference.png`, `${docRoot}/character-direction/construction-guide.png`,
    ...['PROJECT_CONTEXT', 'AI_FEATURES', 'DECISIONS', 'CHANGELOG'].map(name => `docs/${name}.md`)]),
  evidenceHashes: records(evidence),
  evidenceBoundary: 'Original mesh and real WebGL presets; fixed software fixtures and injected synthetic streams; real local model receives only blank generated images. No real camera or person was recorded.',
  stages: { geometry: 'implemented', rendering: 'implemented and desktop tested', presets: 'implemented and desktop tested', mirrorPipeline: 'implemented, blank model and software verified', realHumanMirror: 'unmeasured', physicalPhone: 'unmeasured', teachingReview: 'not performed' },
  cloudModelCalls: 0, realCameraCalls: 0, infrastructureCostUsd: null,
  unresolved: ['Real human mirror accuracy, >=15Hz posture updates and end-to-end latency unmeasured', 'Physical mobile performance unmeasured', 'Broad repository lint includes historical/generated/vendor files and failed; source-scoped lint passed', 'Three.js experiment chunk warning retained', 'No complete offline verification'],
  noAutomaticNextStage: true,
}
const target = `${docRoot}/ARTIFACTS-PHASE1.json`
writeFileSync(target, `${JSON.stringify(index, null, 2)}\n`)
console.log(JSON.stringify({ path: resolve(root, target), sources: Object.keys(index.sourceHashes).length,
  assets: Object.keys(index.assetHashes).length, build: Object.keys(index.buildHashes).length,
  evidence: Object.keys(index.evidenceHashes).length, missingLinks }, null, 2))
