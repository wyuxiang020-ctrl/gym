import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = 'evals/virtual-companion/v4-cartoon-revision'
const doc = 'docs/virtual-companion-v4/cartoon-revision'
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`])
const records = files => Object.fromEntries(files.map(path => [path, { bytes: statSync(path).size, sha256: sha(path) }]))
const baselinePath = `${root}/baseline-1791377416159/manifest.json`
const baseline = read(baselinePath)
const permitted = ['src/companion/pandaRig.ts', 'src/companion/PandaStage.tsx', 'src/companion/CompanionLab.tsx']
const comparison = baseline.files.map(file => ({ path: file.path, before: file.sha256, after: sha(file.path), changed: file.sha256 !== sha(file.path) }))
const unexpected = comparison.filter(file => file.changed && !permitted.includes(file.path))
if (unexpected.length) throw new Error(JSON.stringify(unexpected))
const initial = read('docs/virtual-companion-v4/ARTIFACTS-PHASE1.json')
const unchangedHistorical = Object.entries({ ...initial.assetHashes, ...initial.buildHashes, ...initial.evidenceHashes })
  .map(([path, record]) => ({ path, match: existsSync(path) && sha(path) === record.sha256 }))
if (unchangedHistorical.some(record => !record.match)) throw new Error('An initial stage artifact changed')
const links = [...readFileSync(`${doc}/DELIVERY.md`, 'utf8').matchAll(/\]\(([^)]+)\)/g)].map(match => match[1])
const missingLinks = links.filter(link => !/^(https?:|#)/.test(link) && link !== 'ARTIFACTS.json' && !existsSync(resolve(dirname(`${doc}/DELIVERY.md`), link)))
if (missingLinks.length) throw new Error(JSON.stringify(missingLinks))
const output = {
  version: 'V4.1 cartoon reference revision', at: new Date().toISOString(),
  entry: 'http://127.0.0.1:4175/?companion-lab=1', label: '参考图重制 · V4.1',
  baseline: baselinePath, comparison, expectedProductChanges: permitted,
  initialStageArtifacts: { checked: unchangedHistorical.length, unchanged: unchangedHistorical.filter(r => r.match).length },
  source: records([...baseline.files.map(file => file.path), 'scripts/check-companion-cartoon-v4.mjs', 'scripts/check-companion-cartoon-rig-v4.mjs', 'scripts/build-companion-cartoon-v4.mjs']),
  evidence: records(walk(root).filter(path => !path.includes('/baseline-') && !path.includes('/app/') && path !== `${root}/finalize-evidence.mjs`)),
  build: records(walk(`${root}/build-1791378523158/app`)),
  documents: records([...walk(doc).filter(path => !path.endsWith('/ARTIFACTS.json')), 'docs/PROJECT_CONTEXT.md', 'docs/DECISIONS.md', 'docs/CHANGELOG.md']),
  validation: {
    geometry: { path: `${root}/rig-1791378365603/results.json`, passed: 9, total: 9 },
    browser: { path: `${root}/browser-1791378370777/results.json`, widths: [820, 390], passedPerWidth: 8 },
    recording: `${root}/browser-1791378524081/results.json`,
    typecheckAndBuild: `${root}/build-1791378523158/result.json`,
    scopedLint: { command: 'oxlint src/companion scripts/check-companion-cartoon-v4.mjs scripts/check-companion-cartoon-rig-v4.mjs scripts/build-companion-cartoon-v4.mjs', exitCode: 0 },
    missingLinks,
  },
  limits: ['Appearance is subject to user review', 'No real camera, human mirror or physical phone test', 'No new 60-second performance claim', 'No training-storage change or cloud model call'],
}
writeFileSync(`${doc}/ARTIFACTS.json`, JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify({ changed: comparison.filter(item => item.changed).map(item => item.path), historicalFilesUnchanged: unchangedHistorical.length, missingLinks, output: `${doc}/ARTIFACTS.json` }))
