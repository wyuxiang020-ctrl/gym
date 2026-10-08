import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'

// Explicit allowlists keep credentials, browser data and dependencies out.
const files = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []) : []
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const at = new Date().toISOString()
const root = `evals/virtual-companion/v4-phase0/run-${at.replace(/[:.]/g, '-')}`
const configs = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'index.html', '.gitignore', '.vercelignore', '.oxlintrc.json', 'CLAUDE.md', 'README.md']
const source = [...files('src'), ...files('api'), ...files('scripts'), ...files('public'), ...configs].sort()
const historical = [...files('docs'), ...files('evals/video-pilot'), ...files('evals/workout-save')].sort()
const existingBuild = files('dist').sort()
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trimEnd()
const index = JSON.parse(readFileSync('docs/video-pilot-v3-3/ARTIFACTS.json', 'utf8'))
const compare = hashes => Object.entries(hashes).map(([path, expected]) => ({ path, expected, actual: existsSync(path) ? hash(path) : null })).map(row => ({ ...row, match: row.actual === row.expected }))
const baseline = {
  version: 'virtual-companion-v4-phase0', at, timezone: 'Asia/Shanghai', root,
  authorization: 'User approved phase 0 only. Character appearance must be discussed together before phase 1; phase 1 is not authorized.',
  git: { branch: git(['branch', '--show-current']), head: git(['rev-parse', 'HEAD']), status: git(['status', '--short', '--untracked-files=all']) },
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  sourceHashes: Object.fromEntries(source.map(p => [p, hash(p)])),
  historicalHashes: Object.fromEntries(historical.map(p => [p, hash(p)])),
  existingBuildHashes: Object.fromEntries(existingBuild.map(p => [p, hash(p)])),
  v33SourceComparison: compare(index.sourceHashes), v33BundleComparison: compare(index.bundleHashes),
  snapshot: { type: 'Exact bytes copied; original files remain in place', paths: [...source, ...historical.filter(p => p.startsWith('docs/') && /\.(md|json)$/.test(p))], exclusions: ['.env*', '.vercel/', '.git/', 'node_modules/', 'browser profiles and local/session storage', 'historical media and eval results are hashed, not duplicated'] },
  realCloudModelCalls: 0, modelCostUsd: 0, cameraEnabled: false, deployed: false,
}
mkdirSync(root, { recursive: true })
for (const path of baseline.snapshot.paths) {
  const dest = `${root}/snapshot/${path}`
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(path, dest, constants.COPYFILE_EXCL)
  if (hash(dest) !== hash(path)) throw new Error(`Snapshot verification failed: ${path}`)
}
writeFileSync(`${root}/baseline.json`, JSON.stringify(baseline, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ root, sourceFiles: source.length, historicalFiles: historical.length, snapshotFiles: baseline.snapshot.paths.length, snapshotBytes: baseline.snapshot.paths.reduce((n,p) => n + statSync(p).size, 0), existingBuildFiles: existingBuild.length, v33Sources: { total: baseline.v33SourceComparison.length, matched: baseline.v33SourceComparison.filter(x => x.match).length }, v33Bundle: { total: baseline.v33BundleComparison.length, matched: baseline.v33BundleComparison.filter(x => x.match).length } }, null, 2))
