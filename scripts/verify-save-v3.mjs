import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const at=new Date().toISOString()
const commands=[['build',['run','build']],['lint',['run','lint']],['AI contract',['run','check:ai-contracts']],['API guards',['run','check:api-guards']],['demo safeguards',['run','check:demo-safety']],['storage flow',['run','check:workout-save']]]
const results=[]
for(const [name,args] of commands){const started=Date.now();const r=spawnSync('npm.cmd',args,{shell:true,encoding:'utf8',timeout:180000});results.push({name,exitCode:r.status,ms:Date.now()-started,output:r.stdout,errors:r.stderr});console.log(`${name}: ${r.status===0?'PASS':'FAIL'}`)}
const history=spawnSync('git',['diff','--exit-code','e96c5b2','--','evals/workout-parser','evals/food-ai'],{encoding:'utf8'})
const holdout=JSON.parse(readFileSync('evals/workout-save/v3/results/holdout-1790778147007/run.json','utf8'))
const changed=Object.entries(holdout.sourceAfter).filter(([p,h])=>createHash('sha256').update(readFileSync(p)).digest('hex')!==h).map(([p])=>p)
const report={at,version:'save-v3-2026-09-30',baseline:'e96c5b2',results,historicalEvaluationsUnchanged:history.status===0,historicalDiff:history.stdout,changesSinceHoldout:changed}
const output=`evals/workout-save/v3/results/verification-${Date.now()}.json`;writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,historicalEvaluationsUnchanged:report.historicalEvaluationsUnchanged,changesSinceHoldout:changed}))
if(results.some(r=>r.exitCode!==0)||history.status!==0||changed.length)process.exitCode=1
