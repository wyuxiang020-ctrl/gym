import './ts-test-loader.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const { parseWorkoutResponse, validateWorkoutForSave } = await import('../src/lib/aiValidation.ts')

if(!process.argv.includes('--live')) throw new Error('Use --live to authorize paid calls through the protected local API')
const mode=process.argv.find(a=>a.startsWith('--suite='))?.split('=')[1] || 'smoke'
if(!['smoke','regression','holdout'].includes(mode))throw new Error('Unknown suite')
try{process.loadEnvFile('.env.local')}catch{}
const sha=value=>createHash('sha256').update(value).digest('hex')
const critical=execFileSync('git',['ls-files','src','api'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>/\.(ts|tsx)$/.test(p)).concat(['src/lib/strength.ts','src/components/workout/WeightEditor.tsx','evals/workout-save/v3/holdout.json','scripts/run-workout-save-v3.mjs'])
const hashes=()=>Object.fromEntries([...new Set(critical)].map(p=>[p,sha(readFileSync(p))]))
const frozen=hashes()
if(frozen['evals/workout-save/v3/holdout.json']!=='a5dda8426f31344f64d58e9bade3ede7f18fd93d4fd22529e326afe20f75cbfe')throw new Error('Frozen holdout changed')
const old=JSON.parse('['+readFileSync('evals/workout-parser/v2/cases.jsonl','utf8').trim().split(/\r?\n/).join(',')+']')
const cases=mode==='holdout'?JSON.parse(readFileSync('evals/workout-save/v3/holdout.json','utf8')).cases:mode==='regression'?old.map(c=>({...c,id:c.case_id,text:c.input})):[{id:'SMOKE-01',text:'刚完成负重登阶22公斤一组5次。',weightState:'known',weight:22,reps:[5],done:true}]
const runId=`${mode}-${Date.now()}`;const out=`evals/workout-save/v3/results/${runId}`;mkdirSync(out,{recursive:true})
const records=[]
const report={version:'save-v3',runId,startedAt:new Date().toISOString(),suite:mode,kind:'real model; synthetic input, NOT human research',expected:cases.length,retries:0,sourceBefore:frozen,records,pricing:{input:0.25,cached:0.025,output:2,per:1000000,source:'https://developers.openai.com/api/docs/models/gpt-5-mini',checked:'2026-09-30'},costWarning:'Estimated usage price, not invoice; failures without usage have unknown cost, never treated as free.'}
function score(c,p){
  const notes=[];const s=p.strength.flatMap(e=>e.sets);const valid=validateWorkoutForSave(p)
  function check(ok,message){if(!ok)notes.push(message)}
  if(mode!=='regression'){
    if(c.done===false&&s.length===0&&p.cardio.length===0)return {pass:true,saveAllowed:false,notes:['Empty non-completed record is an allowed safe response.']}
    const counts=c.reps||c.seconds
    check(s.length===counts.length,'Wrong set count')
    check(p.strength.length===1&&p.cardio.length===0,'Wrong entry count')
    s.forEach((v,i)=>{check(v.weightState===c.weightState,`weightState ${i}`);check(c.weight===null?v.weight===null:Math.abs(v.weight-c.weight)<0.01,`weight ${i}`);check((c.reps?v.reps:v.durationSeconds)===counts[i],`reps/seconds ${i}`);check(v.done===c.done,`done ${i}`)})
    check(valid.ok===!c.saveBlocked,'Save boundary mismatch')
  }else if(c.id==='WO-13'||c.id==='WO-19'){
    check(s.length===4&&s.every(v=>v.weightState==='unknown'&&v.weight===null&&v.reps===8&&v.done),'Missing weight/unit must preserve 4x8 unknown');check(!valid.ok,'Must block incomplete save')
  }else if(c.id==='WO-14'){
    check(p.strength.length===1&&s.length===0,'Missing sets/reps invented');check(!valid.ok,'Must block empty sets')
  }else if(c.id==='WO-20'){
    check(s.every(v=>!v.done)&&p.cardio.every(v=>v.done===false),'Future marked done');check(!valid.ok,'Future allowed save')
  }else{
    const expected=c.expected
    check(p.strength.length===expected.strength.length&&p.cardio.length===expected.cardio.length,'Entry count')
    expected.strength.forEach((e,i)=>{
      const actual=p.strength[i];check(actual?.name===e.name,`Name ${i} exact match`);check(actual?.sets.length===e.sets.length,`Sets ${i}`)
      e.sets.forEach((v,j)=>{
        const a=actual?.sets[j];if(!a){notes.push('Missing set');return}
        const state=v.weight>0?'known':c.id==='WO-18'?'unknown':'bodyweight'
        check(a.weightState===state,`State ${i}/${j}`);check(state==='known'?Math.abs(a.weight-v.weight)<0.05:a.weight===null,`Weight ${i}/${j}`)
        check((a.reps??null)===v.reps&&(a.durationSeconds??null)===v.durationSeconds&&a.done===v.done,`Set fields ${i}/${j}`)
      })
    })
    expected.cardio.forEach((e,i)=>{const a=p.cardio[i];for(const k of ['type','minutes','distance','avgHr','intensity'])if(k in e)check((a?.[k]??null)===e[k],`Cardio ${i}/${k}`);check(a?.done===true,`Cardio completion ${i}`)})
    if(['WO-15','WO-16','WO-18'].includes(c.id))check(!valid.ok,'Should require correction or refuse empty save')
    else check(valid.ok,'Fully specified record blocked')
  }
  return {pass:notes.length===0,saveAllowed:valid.ok,notes}
}
for(const c of cases){
  const started=Date.now();const row={id:c.id,input:c.text,attempt:1,retry:false,startedAt:new Date().toISOString(),status:null,pass:false,usage:null,estimatedCostUsd:null}
  try{
    const r=await fetch('http://127.0.0.1:3000/api/parse-workout',{method:'POST',headers:{'content-type':'application/json',...(process.env.GYM_DEMO_ACCESS_CODE?{'x-gym-access-code':process.env.GYM_DEMO_ACCESS_CODE}:{})},body:JSON.stringify({text:c.text}),signal:AbortSignal.timeout(120000)})
    row.status=r.status;const raw=await r.text();row.rawSha256=sha(raw)
    // Synthetic inputs only. No headers or environment values are persisted.
    writeFileSync(`${out}/${c.id}-response.json`,raw)
    const body=JSON.parse(raw);row.meta=body.meta;row.usage=body.meta?.usage??null
    if(row.usage){const u=row.usage;row.estimatedCostUsd=((u.inputTokens-u.cachedInputTokens)*0.25+u.cachedInputTokens*0.025+u.outputTokens*2)/1e6}
    if(!r.ok){row.error=body.error||`HTTP ${r.status}`}else{
      const p=parseWorkoutResponse(body);row.score=score(c,p);row.pass=row.score.pass
    }
  }catch(error){row.error=error.message}
  row.ms=Date.now()-started;records.push(row)
  writeFileSync(`${out}/${c.id}-attempt.json`,JSON.stringify(row,null,2),{flag:'wx'})
  writeFileSync(`${out}/run.partial.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify({id:row.id,status:row.status,pass:row.pass,ms:row.ms,estimatedCostUsd:row.estimatedCostUsd,error:row.error,notes:row.score?.notes}))
  if(row.status!==200){report.stopped='Infrastructure/API failure: no automatic retry; remaining inputs NOT_RUN';break}
}
report.sourceAfter=hashes();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter)
report.summary={attempted:records.length,notRun:cases.length-records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass).length,estimatedKnownCostUsd:records.reduce((s,r)=>s+(r.estimatedCostUsd??0),0),unknownCostRequests:records.filter(r=>r.usage===null).length}
writeFileSync(`${out}/run.json`,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({output:out,...report.summary,sourceUnchanged:report.sourceUnchanged}))
if(!report.sourceUnchanged||report.summary.failed||report.summary.notRun)process.exitCode=1
