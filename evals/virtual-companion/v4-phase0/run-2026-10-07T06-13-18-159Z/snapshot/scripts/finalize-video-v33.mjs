import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync, constants } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = 'evals/video-pilot/v3-3'
const docs = 'docs/video-pilot-v3-3'
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const baseline = JSON.parse(readFileSync(`${root}/baseline.json`, 'utf8'))
const sources = [...files('src'), ...files('api'), 'package.json', 'vite.config.ts']
const maintained = ['docs/PROJECT_CONTEXT.md', 'docs/CHANGELOG.md']
const historicalChanged = Object.entries(baseline.historicalHashes).filter(([p,h]) => !maintained.includes(p) && (!existsSync(p) || hash(p) !== h)).map(([p]) => p)
const apiChanged = Object.entries(baseline.sourceHashes).filter(([p,h]) => p.startsWith('api/') && hash(p) !== h).map(([p]) => p)
const commands = []
for (const command of ['build','lint']) {
  const start = Date.now(); const r = spawnSync('npm.cmd', ['run', command], { encoding: 'utf8', shell: true, timeout: 120000 })
  commands.push({ command, exitCode: r.status, ms: Date.now() - start, stdout: r.stdout, stderr: r.stderr })
}
const flow = JSON.parse(readFileSync(`${root}/flow-390-1790868892213/results.json`, 'utf8'))
const recordings = {}
for (const [prefix, name] of [['F01','Gym-V3.3-normal-replay.webm'],['F02','Gym-V3.3-failure-recovery-replay.webm']]) {
  const record = flow.results.find(r => r.name.startsWith(prefix))
  const path = `${docs}/${name}`
  copyFileSync(record.recording, path, constants.COPYFILE_EXCL)
  recordings[prefix] = { path, sha256: hash(path), kind: 'synthetic records and fixed player events; NOT actual media/human/model; deliberately slowed automation', evidence: `${root}/flow-390-1790868892213/results.json`, machineMs: record.ms }
}
const manifest = {
  version: '训练示范 V3.3', at: new Date().toISOString(), deployed: false, localUrl: 'http://127.0.0.1:4174/',
  modelCalls: 0, modelCostUsd: 0, subscriptionPurchased: false, humanTests: 'NOT_RUN', authorFormalTask: 'NOT_RUN',
  baseline: `${root}/baseline.json`, report: `${docs}/DELIVERY.md`, historicalChanged, apiChanged, commands,
  sourceHashes: Object.fromEntries(sources.map(p => [p,hash(p)])),
  newProductFiles: sources.filter(p => !baseline.sourceHashes[p]),
  changedProductFiles: sources.filter(p => baseline.sourceHashes[p] && hash(p) !== baseline.sourceHashes[p]),
  finalPlayerTests: [`${root}/player-390-1790868880567/results.json`,`${root}/player-820-1790868890882/results.json`],
  finalFlowTests: [`${root}/flow-390-1790868892213/results.json`,`${root}/flow-820-1790868914502/results.json`],
  regressions: `${root}/regression-1790868674389/results.json`,
  actualPlayback: `${root}/live-1790868694529/results.json`,
  playbackScope: 'observed four videos beginning to play and advancing ~3.5s; before final return-button wording split; playback engine unchanged; not full video review',
  recordings,
  bundleHashes: Object.fromEntries(files('dist').map(p => [p,hash(p)])),
}
writeFileSync(`${docs}/ARTIFACTS.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ manifest: `${docs}/ARTIFACTS.json`, historicalChanged, apiChanged, changedProductFiles: manifest.changedProductFiles, newProductFiles: manifest.newProductFiles, commands: commands.map(c => ({command:c.command,exitCode:c.exitCode})) }))
if (historicalChanged.length || apiChanged.length || commands.some(c=>c.exitCode!==0)) process.exitCode = 1
