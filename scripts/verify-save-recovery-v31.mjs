import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const { parseWorkoutDraft, parseWorkoutResponse, validateWorkoutForSave } = await import('../src/lib/aiValidation.ts')
const { getWorkoutDraft, saveWorkoutDraft } = await import('../src/lib/store.ts')
const out=`evals/workout-save/v3-1/verification-${Date.now()}`;mkdirSync(out,{recursive:true})
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(`${dir}/${d.name}`):[`${dir}/${d.name}`])}
const historical=()=>Object.fromEntries(['evals/workout-parser','evals/food-ai','evals/workout-save/v3'].flatMap(files).concat(['docs/weekly-save-v3/HUMAN_TASKS.md','docs/weekly-save-v3/REAL_FOOD_SAMPLES.md','docs/weekly-save-v3/DELIVERY.md']).map(p=>[p,sha(p)]))
const historyBefore=historical();const checks=[]
function test(name,fn){const started=Date.now();try{fn();checks.push({name,pass:true,ms:Date.now()-started})}catch(e){checks.push({name,pass:false,ms:Date.now()-started,error:e.message})}}
const map=new Map();globalThis.sessionStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}
const sample=()=>({strength:[{name:'卧推',sets:[{weight:50,weightState:'known',reps:8,done:true}]}],cardio:[{type:'快走',minutes:15,intensity:'mid',done:true}]})
test('blank name draft recovers but cannot save',()=>{const p=sample();p.strength[0].name='';assert.equal(parseWorkoutDraft(p).strength[0].name,'');assert.equal(validateWorkoutForSave(parseWorkoutDraft(p)).ok,false);assert.throws(()=>parseWorkoutResponse({result:p}))})
test('invalid numeric draft recovers while final save and API parser reject',()=>{const p=sample();Object.assign(p.cardio[0],{minutes:0,avgHr:999,distance:-1});const r=parseWorkoutDraft(p);assert.equal(r.cardio[0].avgHr,999);assert.equal(r.cardio[0].distance,-1);assert.equal(validateWorkoutForSave(r).ok,false);assert.throws(()=>parseWorkoutResponse({result:p}))})
test('blank minutes recovers as null',()=>{const p=sample();p.cardio[0].minutes=null;assert.equal(parseWorkoutDraft(p).cardio[0].minutes,null);assert.equal(validateWorkoutForSave(parseWorkoutDraft(p)).ok,false)})
test('long editable name remains correctable',()=>{const p=sample();p.strength[0].name='测'.repeat(101);assert.equal(parseWorkoutDraft(p).strength[0].name.length,101);assert.equal(validateWorkoutForSave(parseWorkoutDraft(p)).ok,false)})
test('draft wrong structural type rejected',()=>{const p=sample();p.cardio[0].minutes={bad:true};assert.throws(()=>parseWorkoutDraft(p));assert.throws(()=>parseWorkoutDraft({strength:{},cardio:[]}))})
test('non-finite draft numbers rejected',()=>{for(const v of [NaN,Infinity,-Infinity]){const p=sample();p.cardio[0].minutes=v;assert.throws(()=>parseWorkoutDraft(p))}})
test('draft still rejects invalid known weight and excessive arrays',()=>{const p=sample();p.strength[0].sets[0].weight=0;assert.throws(()=>parseWorkoutDraft(p));const q=sample();q.strength=Array(31).fill(q.strength[0]);assert.throws(()=>parseWorkoutDraft(q))})
test('corrupt preview preserves original input and warning',()=>{const raw=JSON.stringify({text:'保留原文',preview:{strength:'bad'}});map.set('gym-workout-draft-v3:2026-10-01',raw);const d=getWorkoutDraft('2026-10-01');assert.equal(d.text,'保留原文');assert.equal(d.preview,null);assert.ok(d.notice);assert.equal(map.get('gym-workout-draft-v3:2026-10-01'),raw)})
test('malformed JSON is not overwritten by read',()=>{map.set('gym-workout-draft-v3:2026-10-01','broken');assert.ok(getWorkoutDraft('2026-10-01').notice);assert.equal(map.get('gym-workout-draft-v3:2026-10-01'),'broken')})
test('legacy valid draft keeps namespace and restores normally',()=>{const p=sample();assert.equal(saveWorkoutDraft('2026-10-01','原文',p),true);const d=getWorkoutDraft('2026-10-01');assert.equal(d.text,'原文');assert.equal(validateWorkoutForSave(d.preview).ok,true)})
const commands=[['build',['run','build']],['lint',['run','lint']],['AI contracts',['run','check:ai-contracts']],['demo safeguards',['run','check:demo-safety']],['storage regression',['run','check:workout-save']]]
const results=[]
for(const [name,args] of commands){const started=Date.now();const r=spawnSync('npm.cmd',args,{shell:true,encoding:'utf8',timeout:180000,env:{...process.env,GYM_TEST_VERSION:'save-v3.1',GYM_TEST_OUTPUT_ROOT:'evals/workout-save/v3-1'}});results.push({name,exitCode:r.status,ms:Date.now()-started,output:r.stdout,errors:r.stderr});writeFileSync(`${out}/commands.partial.json`,JSON.stringify(results,null,2));console.log(`${name}: ${r.status===0?'PASS':'FAIL'}`)}
const historicalUnchanged=JSON.stringify(historyBefore)===JSON.stringify(historical())
const first=JSON.parse(readFileSync('evals/workout-save/v3-1/before-1790861102209/results.json','utf8'))
const unchangedApi=Object.fromEntries(Object.entries(first.sourceHashes).filter(([p])=>p.startsWith('api/')).map(([p,h])=>[p,sha(p)===h]))
const report={version:'save-v3.1',kind:'automated software tests; no model requests or humans',at:new Date().toISOString(),checks,results,historicalUnchanged,historyBefore,unchangedApi,sourceHashes:Object.fromEntries([...files('src'),...files('api')].map(p=>[p,sha(p)]))}
writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({out,passed:checks.filter(c=>c.pass).length,total:checks.length,historicalUnchanged,unchangedApi}));if(checks.some(c=>!c.pass)||results.some(r=>r.exitCode!==0)||!historicalUnchanged||Object.values(unchangedApi).some(x=>!x))process.exitCode=1
