import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = 'evals/workout-save/v3-2'
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const walk = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name).replaceAll('\\', '/')
  if (p.startsWith(root) || /(?:^|\/)(?:\.env[^/]*|\.vercel|node_modules|\.git)(?:\/|$)/.test(p)) return []
  return e.isDirectory() ? walk(p) : [p]
}) : []
const baselinePath = `${root}/baseline.json`
if (process.argv.includes('--snapshot')) {
  if (existsSync(baselinePath)) throw new Error('Baseline exists; refusing to replace historical evidence')
  const sources = [...walk('src'), ...walk('api')]
  const history = [...walk('docs'), ...walk('evals')]
  mkdirSync(`${root}/baseline-source`, { recursive: true })
  for (const p of sources) {
    const dest = `${root}/baseline-source/${p}`
    mkdirSync(dest.slice(0, dest.lastIndexOf('/')), { recursive: true })
    writeFileSync(dest, readFileSync(p), { flag: 'wx' })
  }
  const manifest = {
    version: 'missing-weight-v3.2-baseline', at: new Date().toISOString(),
    gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceHashes: Object.fromEntries(sources.map(p => [p, hash(p)])),
    historicalHashes: Object.fromEntries(history.map(p => [p, hash(p)])),
    excluded: ['environment files', '.vercel', '.git', 'node_modules', root],
    note: 'Source snapshot and historical hashes frozen before this iteration; no secrets copied. Not a clean Git checkout claim.',
  }
  writeFileSync(baselinePath, JSON.stringify(manifest, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ baselinePath, sources: sources.length, history: history.length }))
  process.exit(0)
}

const phase = process.argv.includes('--before') ? 'before' : 'after'
const sourceBase = phase === 'before' ? '../evals/workout-save/v3-2/baseline-source/src/lib/' : '../src/lib/'
const strength = await import(new URL(`${sourceBase}strength.ts`, import.meta.url))
const ai = await import(new URL(`${sourceBase}aiValidation.ts`, import.meta.url))
const data = await import(new URL(`${sourceBase}dataValidation.ts`, import.meta.url))
const store = await import(new URL(`${sourceBase}store.ts`, import.meta.url))
const checkIn = await import(new URL(`${sourceBase}checkIn.ts`, import.meta.url))
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() } }
globalThis.localStorage = memory(); globalThis.sessionStorage = memory()
const date = '2026-10-01'
const unknown = { weight: null, weightState: 'unknown', reps: 8, done: true }
const missing = { ...unknown, missingWeightConfirmed: true }
const known = { weight: 50, weightState: 'known', reps: 8, done: true }
const workout = sets => ({ strength: [{ name: '卧推', sets, note: '', uncertain: [] }], cardio: [] })
const day = sets => ({ date, checkedIn: false, strength: [{ id: 'synthetic-v32', ...workout(sets).strength[0], source: 'nl', estKcal: 0 }], cardio: [], meals: [], water: 0 })
const checks = []
async function test(id, name, fn) {
  const start = performance.now()
  try { await fn(); checks.push({ id, name, pass: true, ms: performance.now() - start }) }
  catch (e) { checks.push({ id, name, pass: false, ms: performance.now() - start, error: e.message }) }
}
await test('M01', 'Unreviewed unknown still blocks final save', () => assert.equal(ai.validateWorkoutForSave(workout([unknown])).ok, false))
await test('M02', 'Explicit missing confirmation permits completed save', () => assert.equal(ai.validateWorkoutForSave(workout([missing])).ok, true))
await test('M03', 'Completion and weight resolution are separate', () => {
  assert.equal(strength.resolvedWeight(missing), false)
  assert.equal(strength.validCompletedSet(missing), true)
  assert.equal(strength.confirmedMissingWeight?.(missing), true)
})
await test('M04', 'Confirmed missing load excluded from volume and calorie eligibility', () => {
  assert.equal(strength.setVolume(missing), 0)
  assert.equal(strength.validEstimatedSet?.(missing), false)
  assert.equal(strength.validEstimatedSet?.(known), true)
  assert.equal(checkIn.dayVolume(day([missing, known])), 400)
})
await test('M05', 'Model response cannot impersonate user confirmation', () => {
  const parsed = ai.parseWorkoutResponse({ result: workout([missing]) })
  assert.equal(parsed.strength[0].sets[0].missingWeightConfirmed, undefined)
  assert.equal(ai.validateWorkoutForSave(parsed).ok, false)
})
await test('M06', 'Draft parsing preserves only legal explicit user confirmation', () => {
  assert.equal(ai.parseWorkoutDraft(workout([missing])).strength[0].sets[0].missingWeightConfirmed, true)
  // Either explicit rejection or stripping is safe; never retain consent on a known load.
  let parsed
  try { parsed = ai.parseWorkoutDraft(workout([{ ...known, missingWeightConfirmed: true }])) } catch { return }
  assert.notEqual(parsed.strength[0].sets[0].missingWeightConfirmed, true)
})
await test('M07', 'Session draft refresh roundtrip preserves explicit missing confirmation', () => {
  store.saveWorkoutDraft(date, '卧推8次，重量忘了', workout([missing]))
  const draft = store.getWorkoutDraft(date)
  assert.equal(draft.preview.strength[0].sets[0].missingWeightConfirmed, true)
  assert.equal(ai.validateWorkoutForSave(draft.preview).ok, true)
})
await test('M08', 'Save/reopen/export/import retains null and explicit confirmation', () => {
  store.replaceDayLog(date, day([missing]))
  assert.deepEqual(store.getDayLog(date).strength[0].sets[0], missing)
  const exported = store.exportData(); store.importData(exported)
  assert.deepEqual(store.getDayLog(date).strength[0].sets[0], missing)
  assert.equal(checkIn.hasCompletedWorkout(store.getDayLog(date)), true)
  assert.equal(checkIn.dayVolume(store.getDayLog(date)), 0)
})
await test('M09', 'Revocation restores unresolved and blocked state', () => {
  const revoked = { ...missing, missingWeightConfirmed: undefined }
  assert.equal(ai.validateWorkoutForSave(workout([revoked])).ok, false)
  assert.equal(strength.validCompletedSet(revoked), false)
})
await test('M10', 'Confirmed missing does not turn future plans into completed facts', () => {
  assert.equal(ai.validateWorkoutForSave(workout([{ ...missing, done: false }])).ok, false)
  assert.equal(strength.validCompletedSet({ ...missing, done: false }), false)
})
await test('M11', 'Bulk application clears missing consent without changing done/reps', () => {
  const applied = strength.applyFirstWeight([known, { ...missing, done: false }])
  assert.equal(applied[1].weight, 50)
  assert.notEqual(applied[1].missingWeightConfirmed, true)
  assert.equal(applied[1].done, false); assert.equal(applied[1].reps, 8)
  assert.throws(() => strength.applyFirstWeight([missing, unknown]))
})
await test('M12', 'Legacy zero remains unconfirmed missing and excluded', () => {
  const parsed = data.parseGymData({ dayLogs: { [date]: day([{ weight: 0, reps: 8, done: true }]) } })
  const set = parsed.dayLogs[date].strength[0].sets[0]
  assert.equal(set.weight, null); assert.equal(set.weightState, 'unknown')
  assert.notEqual(set.missingWeightConfirmed, true); assert.equal(set.legacyWeight, 0)
  assert.equal(strength.validCompletedSet(set), false)
})
await test('M13', 'Storage failure preserves previous record and confirmed draft for retry', () => {
  store.replaceDayLog(date, day([known])); const before = localStorage.getItem('gym-data-v1')
  store.saveWorkoutDraft(date, '重量忘了', workout([missing]))
  const original = localStorage.setItem; localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  try { assert.throws(() => store.replaceDayLog(date, day([missing]))) } finally { localStorage.setItem = original }
  assert.equal(localStorage.getItem('gym-data-v1'), before)
  assert.equal(store.getWorkoutDraft(date).preview.strength[0].sets[0].missingWeightConfirmed, true)
  store.replaceDayLog(date, day([missing])); assert.equal(store.getDayLog(date).strength[0].sets[0].missingWeightConfirmed, true)
})
await test('M14', 'Malformed explicit flag cannot bypass completion rules', () => {
  for (const value of ['true', 1, false, null]) assert.equal(ai.validateWorkoutForSave(workout([{ ...unknown, missingWeightConfirmed: value }])).ok, false)
  for (const value of [0, 50]) assert.equal(ai.validateWorkoutForSave(workout([{ ...missing, weight: value }])).ok, false)
  assert.equal(ai.validateWorkoutForSave(workout([{ ...missing, reps: 0 }])).ok, false)
})
await test('M15', 'Existing known/bodyweight/not-applicable semantics unchanged', () => {
  for (const set of [known, { ...unknown, weightState: 'bodyweight' }, { ...unknown, weightState: 'not_applicable' }]) {
    assert.equal(ai.validateWorkoutForSave(workout([set])).ok, true)
    assert.equal(strength.validCompletedSet(set), true)
  }
  assert.equal(strength.setVolume(known), 400)
})
await test('M16', 'Frozen evaluation archives and historical reports remain byte-identical', () => {
  const maintainedDocs = ['docs/PROJECT_CONTEXT.md', 'docs/AI_FEATURES.md', 'docs/CHANGELOG.md', 'docs/DECISIONS.md']
  for (const [p, digest] of Object.entries(JSON.parse(readFileSync(baselinePath, 'utf8')).historicalHashes)) {
    if (!maintainedDocs.includes(p)) assert.equal(hash(p), digest, p)
  }
})
const report = {
  version: 'workout-save-v3.2', phase, at: new Date().toISOString(),
  kind: 'deterministic synthetic software tests; NOT model quality or human testing',
  realModelCalls: 0, costUsd: 0, baselineManifest: baselinePath,
  sourceMode: phase === 'before' ? 'Frozen actual source snapshot' : 'Current working tree',
  sourceHashes: phase === 'before' ? JSON.parse(readFileSync(baselinePath, 'utf8')).sourceHashes : Object.fromEntries([...walk('src'), ...walk('api')].map(p => [p, hash(p)])),
  checks, passed: checks.filter(x => x.pass).length, total: checks.length,
}
mkdirSync(root, { recursive: true })
const output = `${root}/deterministic-${phase}-${Date.now()}.json`
writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ output, ...report }, null, 2))
if (checks.some(c => !c.pass)) process.exitCode = 1
