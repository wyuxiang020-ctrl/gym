import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const packageRoot = 'node_modules/@mediapipe/tasks-vision'
const pkg = JSON.parse(readFileSync(`${packageRoot}/package.json`, 'utf8'))
if (pkg.version !== '1.1.0') throw new Error('Review the new version and license before changing the fixed asset set')
const root = 'public/companion-assets'
mkdirSync(`${root}/wasm`, { recursive: true })
const sha = data => createHash('sha256').update(data).digest('hex')
const files = []
for (const relative of ['vision_bundle.js', ...['vision_wasm_internal', 'vision_wasm_nosimd_internal', 'vision_wasm_module_internal'].flatMap(name => [`wasm/${name}.js`, `wasm/${name}.wasm`])]) {
  const destination = `${root}/${relative}`
  const data = readFileSync(`${packageRoot}/${relative}`)
  if (!existsSync(destination)) copyFileSync(`${packageRoot}/${relative}`, destination, constants.COPYFILE_EXCL)
  if (sha(readFileSync(destination)) !== sha(data)) throw new Error(`Existing asset differs: ${destination}`)
  files.push({ path: destination, source: `@mediapipe/tasks-vision@${pkg.version}/${relative}`, sha256: sha(data), bytes: data.length, license: 'Apache-2.0' })
}
const downloads = [
  ['pose_landmarker_lite.task', 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'],
  ['MEDIAPIPE-LICENSE.txt', 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE'],
]
const expectedDownloads = {
  'pose_landmarker_lite.task': '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  'MEDIAPIPE-LICENSE.txt': '8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8',
}
for (const [name, source] of downloads) {
  const path = `${root}/${name}`
  if (!existsSync(path)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(45000) })
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (name.endsWith('.task') && (bytes.length < 1000000 || bytes.length > 15000000)) throw new Error('Unexpected model size')
    if (sha(bytes) !== expectedDownloads[name]) throw new Error(`Downloaded asset hash differs: ${name}`)
    writeFileSync(path, bytes, { flag: 'wx' })
  }
  const bytes = readFileSync(path)
  if (sha(bytes) !== expectedDownloads[name]) throw new Error(`Existing asset hash differs: ${name}`)
  files.push({ path, source, sha256: sha(bytes), bytes: bytes.length, license: 'Apache-2.0' })
}
const report = { at: new Date().toISOString(), version: pkg.version, model: 'Pose Landmarker Lite float16 version 1', modelInput: { detector: '224x224x3', landmarker: '256x256x3' }, modelCard: 'https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf', modelLicenseEvidence: 'Model card page 2: Apache License, Version 2.0', scope: 'Local inference assets; no photos/videos uploaded; runtime only loads after explicit camera start.', files }
const out = `evals/virtual-companion/v4-poc/assets-${Date.now()}.json`
writeFileSync(out, JSON.stringify(report, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ out, count: files.length, totalBytes: files.reduce((n, f) => n + f.bytes, 0) }))
