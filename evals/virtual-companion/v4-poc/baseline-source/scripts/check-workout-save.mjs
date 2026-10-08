import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import ts from 'typescript'
import { createHash } from 'node:crypto'

const store = await import('../src/lib/store.ts')
const { parseWorkoutResponse, validateWorkoutForSave } = await import('../src/lib/aiValidation.ts')
const { parseGymData } = await import('../src/lib/dataValidation.ts')
const { hasCompletedWorkout, dayVolume } = await import('../src/lib/checkIn.ts')
const { applyFirstWeight } = await import('../src/lib/strength.ts')
const { postJson } = await import('../src/lib/apiClient.ts')
const { validateWorkoutResult } = await import('../api/_lib/validate.ts')
function memory() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,String(v)), removeItem: k => m.delete(k), clear: () => m.clear() } }
globalThis.localStorage = memory(); globalThis.sessionStorage = memory()
const date = '2026-09-30'
const set = { weight: 32, weightState: 'known', reps: 10, done: true }
const entry = sets => ({ id: 'test', name: '测试动作', sets, source: 'nl', estKcal: 18 })
const day = sets => ({ date, checkedIn: false, strength: [entry(sets)], cardio: [], meals: [], water: 0 })
const parsed = sets => ({ strength: [{ name: '测试动作', sets }], cardio: [] })
const wire = s => ({ strength: [{ name: '测试动作', sets: [{ ...s, durationSeconds: null }], note: '', uncertain: [] }], cardio: [] })
const checks = []
async function test(name, fn) { try { await fn(); checks.push({name,pass:true}) } catch(e) { checks.push({name,pass:false,error:e.message}) } }

// Execute the actual baseline source, not a reimplementation of its behavior.
async function baseline(file, dependency) {
  const source = execFileSync('git', ['show', `e96c5b2:${file}`], { encoding: 'utf8' })
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText
    .replaceAll(`'./${dependency}'`, JSON.stringify(new URL(`../src/lib/${dependency}.ts`, import.meta.url).href))
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
}
const oldCheck = await baseline('src/lib/checkIn.ts', 'date')
const oldValidate = await baseline('src/lib/aiValidation.ts', 'met')
const legacy = {weight:0,reps:8,done:true}
const migrated = parseGymData({ dayLogs: {[date]: day([legacy])} }).dayLogs[date]
const beforeAfter = {
  baseline: 'e96c5b2', scenario: 'Unknown legacy weight=0, 8 reps, marked done',
  before: {saveAllowed:oldValidate.validateWorkoutForSave(parsed([legacy])).ok,completed:oldCheck.hasCompletedWorkout(day([legacy])),kcal:18},
  after: {saveAllowed:validateWorkoutForSave(parsed(migrated.strength[0].sets)).ok,completed:hasCompletedWorkout(migrated),kcal:migrated.strength[0].estKcal,storedSet:migrated.strength[0].sets[0]},
}
await test('before/after: unknown zero no longer passes completed/save', () => {
  assert.equal(beforeAfter.before.saveAllowed,true); assert.equal(beforeAfter.before.completed,true)
  assert.equal(beforeAfter.after.saveAllowed,false); assert.equal(beforeAfter.after.completed,false); assert.equal(beforeAfter.after.kcal,0)
})
for (const state of ['known','bodyweight','not_applicable','unknown']) await test(`${state}: storage roundtrip and statistics`, () => {
  const s = {...set,weightState:state,weight:state==='known'?32:null}
  store.replaceDayLog(date,day([s]))
  assert.deepEqual(store.getDayLog(date).strength[0].sets,[s])
  assert.equal(hasCompletedWorkout(store.getDayLog(date)),state!=='unknown')
  assert.equal(validateWorkoutForSave(parsed([s])).ok,state!=='unknown')
  assert.equal(dayVolume(store.getDayLog(date)),state==='known'?320:0)
})
await test('legacy source stays intact on read; zero retained for audit', () => {
  const raw=JSON.stringify({dayLogs:{[date]:day([legacy])}}); localStorage.setItem('gym-data-v1',raw)
  assert.equal(store.getDayLog(date).strength[0].sets[0].legacyWeight,0)
  assert.equal(localStorage.getItem('gym-data-v1'),raw)
})
await test('legacy positive number with missing-unit notice is unresolved', () => {
  const d=day([{weight:55,reps:8,done:true}]); d.strength[0].uncertain=['重量单位不明确']
  assert.equal(parseGymData({dayLogs:{[date]:d}}).dayLogs[date].strength[0].sets[0].weightState,'unknown')
})
await test('legacy positive known weight remains compatible', () => {
  assert.equal(parseGymData({dayLogs:{[date]:day([{weight:55,reps:8,done:true}])}}).dayLogs[date].strength[0].sets[0].weightState,'known')
})
await test('known zero rejected by server and save boundary', () => {
  assert.throws(()=>validateWorkoutResult(wire({...set,weight:0})))
  assert.equal(validateWorkoutForSave(parsed([{...set,weight:0}])).ok,false)
})
await test('missing unit unknown passes parse only, not completed save', () => {
  const p=parseWorkoutResponse({result:validateWorkoutResult(wire({...set,weight:null,weightState:'unknown'}))})
  assert.equal(validateWorkoutForSave(p).ok,false)
})
await test('future strength and cardio blocked until explicitly marked completed', () => {
  assert.equal(validateWorkoutForSave(parsed([{...set,done:false}])).ok,false)
  assert.equal(validateWorkoutForSave({strength:[],cardio:[{type:'跑步',minutes:18,intensity:'mid',done:false}]}).ok,false)
})
await test('bulk edit preserves reps, duration and done; undo uses snapshot', () => {
  const values=[set,{weight:null,weightState:'unknown',durationSeconds:40,done:false}]
  const snapshot=structuredClone(values); const result=applyFirstWeight(values)
  assert.deepEqual(values,snapshot); assert.equal(result[1].weight,32); assert.equal(result[1].durationSeconds,40); assert.equal(result[1].done,false)
  assert.throws(()=>applyFirstWeight([{...set,weightState:'unknown',weight:null}]))
})
await test('draft per date roundtrip does not persist workout', () => {
  localStorage.clear(); saveDraft()
  assert.equal(store.getDayLog(date).strength.length,0)
  assert.deepEqual(JSON.parse(JSON.stringify(store.getWorkoutDraft(date).preview)),parsed([set]))
  assert.equal(store.getWorkoutDraft('2026-10-01').text,'')
  store.saveWorkoutDraft(date,'',null); assert.equal(store.getWorkoutDraft(date).preview,null)
})
function saveDraft(){store.saveWorkoutDraft(date,'合成测试',parsed([set]))}
await test('storage quota failure retains previous whole record', () => {
  store.replaceDayLog(date,day([set])); const raw=localStorage.getItem('gym-data-v1'); const original=localStorage.setItem
  localStorage.setItem=()=>{throw new Error('QuotaExceededError')}
  try {assert.throws(()=>store.replaceDayLog(date,day([{...set,reps:3}]))) } finally {localStorage.setItem=original}
  assert.equal(localStorage.getItem('gym-data-v1'),raw)
})
await test('invalid existing backup not overwritten', () => {
  localStorage.setItem('gym-data-v1','broken'); assert.throws(()=>store.replaceDayLog(date,day([set])))
  assert.equal(localStorage.getItem('gym-data-v1'),'broken'); localStorage.clear()
})
const realFetch=globalThis.fetch
await test('network error surfaced without automatic retry', async()=>{let n=0; globalThis.fetch=async()=>{n++;throw new Error('offline')};await assert.rejects(postJson('/test',{},'失败'),/无法连接/);assert.equal(n,1)})
await test('deadline abort bounds total request wait', async()=>{
  globalThis.fetch=(_u,opts)=>new Promise((_r,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted'))))
  await assert.rejects(postJson('/test',{},'失败',{timeoutMs:20}),/等待已达上限/)
})
await test('caller cancel works with no automatic retry',async()=>{
  const c=new AbortController(); const p=postJson('/test',{},'失败',{signal:c.signal});c.abort();await assert.rejects(p,/已取消等待/)
})
globalThis.fetch=realFetch
const manifestHash=createHash('sha256').update(readFileSync('evals/workout-save/v3/holdout.json')).digest('hex')
assert.equal(manifestHash,'a5dda8426f31344f64d58e9bade3ede7f18fd93d4fd22529e326afe20f75cbfe')
const report={version:process.env.GYM_TEST_VERSION||'workout-save-v3',kind:'deterministic synthetic software tests, NOT human tests',time:new Date().toISOString(),holdoutSha256:manifestHash,beforeAfter,checks,passed:checks.filter(x=>x.pass).length,total:checks.length}
const outputRoot=process.env.GYM_TEST_OUTPUT_ROOT||'evals/workout-save/v3/results'
mkdirSync(outputRoot,{recursive:true})
const output=`${outputRoot}/flow-${Date.now()}.json`
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report},null,2))
if(checks.some(x=>!x.pass))process.exitCode=1
