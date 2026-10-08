import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const verification=JSON.parse(readFileSync('evals/workout-save/v3-1/verification-1790861613628/verification.json','utf8'))
const unchanged=map=>Object.entries(map).filter(([p,h])=>sha(p)!==h).map(([p])=>p)
const before=JSON.parse(readFileSync('evals/workout-save/v3-1/before-1790861102209/results.json','utf8'))
const live=JSON.parse(readFileSync('evals/workout-save/v3-1/preview-1790862086675/results.json','utf8'))
const realFlow=live.records.find(r=>r.kind.startsWith('automated live-model'))
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(`${dir}/${d.name}`):[`${dir}/${d.name}`])}
const artifactFiles=files('docs/save-recovery-v3-1')
const secretPatterns=[/sk-proj-[A-Za-z0-9_-]{10,}/,/sk-ant-[A-Za-z0-9_-]{10,}/,/Bearer\s+[A-Za-z0-9_-]{20,}/]
const suspectFiles=[...files('evals/workout-save/v3-1'),...artifactFiles].filter(p=>/\.(json|md|txt)$/.test(p)).filter(p=>secretPatterns.some(re=>re.test(readFileSync(p,'utf8'))))
const report={version:'save-recovery-v3.1',finalizedAt:new Date().toISOString(),sourceChangedSinceVerification:unchanged(verification.sourceHashes),historicalFilesChanged:unchanged(verification.historyBefore),firstFailuresPreserved:before.checks.filter(c=>!c.pass).map(c=>({id:c.id,ms:c.ms})),apiChangesFromBaseline:Object.keys(before.sourceHashes).filter(p=>p.startsWith('api/')&&sha(p)!==before.sourceHashes[p]),realModel:{attempts:realFlow.modelAttempts,pass:realFlow.pass,usage:realFlow.usage,estimatedCostUsd:realFlow.estimatedCostUsd,requestMs:realFlow.request.ms,flowMs:realFlow.ms},humanTaskStatus:'NOT_MEASURED',authorSelfTestStatus:'NOT_RUN',realFoodStatus:'NOT_MEASURED',deployment:{preview:live.deployment,productionUpdated:false,anonymousPreview:'Vercel login required',frontendBundleMatchesLocal:true},suspectFiles,artifacts:Object.fromEntries(artifactFiles.map(p=>[p,sha(p)]))}
assert.deepEqual(report.sourceChangedSinceVerification,[]);assert.deepEqual(report.historicalFilesChanged,[]);assert.deepEqual(report.apiChangesFromBaseline,[]);assert.equal(report.realModel.pass,true);assert.equal(report.realModel.attempts,1);assert.deepEqual(suspectFiles,[])
for(const video of ['Gym-V3.1-live-preview-save-reopen.webm','Gym-V3.1-normal-fixed-response.webm','Gym-V3.1-network-recovery-fixed-response.webm'])assert.ok(existsSync(`docs/save-recovery-v3-1/${video}`))
const output=`evals/workout-save/v3-1/final-${Date.now()}.json`;writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({output,...report},null,2))
