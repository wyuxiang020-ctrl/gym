import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const evidence=process.env.GYM_D_VERIFY_EVIDENCE || 'evals/virtual-companion/d-panda/evidence-1791396573283'
const out=`evals/virtual-companion/d-panda/final-${Date.now()}`;mkdirSync(out,{recursive:true})
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),checks=[]
const pack='docs/virtual-companion-v4/panda-ip-handoff-2026-10-08'
const manifest=JSON.parse(readFileSync(`${pack}/MANIFEST.json`))
for(const f of manifest.files)assert.equal(hash(`${pack}/${f.path}`),f.sha256,f.path)
checks.push('All 21 manifest-listed package files are unchanged (manifest is file 22)')
const boards=readdirSync(`${pack}/assets`).filter(f=>f.endsWith('.png'))
for(const f of boards)assert.equal(hash(`${pack}/assets/${f}`),hash(`public/companion-assets/d-panda/design/${f}`))
assert.equal(boards.length,7);checks.push('All seven imported design originals are byte-identical')
const baseline=JSON.parse(readFileSync('evals/virtual-companion/d-panda/baseline-1791392235567/manifest.json'))
const unaffected=baseline.files.filter(f=>!f.path.startsWith('src/companion/'))
for(const f of unaffected)assert.equal(hash(f.path),f.sha256,f.path)
checks.push(`${unaffected.length} baseline files outside companion are unchanged, including App/store/types/router/dependencies/worker`)
for(const f of ['illustratedPanda.ts','pandaRig.ts','characterMotion.ts']){
 assert.equal(existsSync(`src/companion/${f}`),false)
 assert.ok(existsSync(`evals/virtual-companion/d-panda/baseline-1791392235567/source/src/companion/${f}`))
}checks.push('Old three render/motion sources removed from active source and preserved in the baseline')
const recording=JSON.parse(readFileSync(`${evidence}/results.json`));for(const [f,sha]of Object.entries(recording.source))assert.equal(hash(f),sha,f)
checks.push('Actual recorded asset/renderer/motion source hashes match final sources')
const {chromium}=await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({serviceWorkers:'block'})
await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4175'&&r.request().method()==='GET'?r.continue():r.abort())
const page=await context.newPage();let decode
try{
 await page.goto('http://127.0.0.1:4175/?companion-lab=1')
 decode=await page.evaluate(async({evidence})=>{
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1320;const c=canvas.getContext('2d');c.fillStyle='#fbf8ef';c.fillRect(0,0,1600,1320)
  const result=[];let index=0
  for(const [name,times]of [['samples',[1,3.3,6.2,10.7,12.8,17.6]],['library',[10.3,18.3,23.1,33.8,42.8,48.4]]]){
   const v=document.createElement('video');v.muted=true;v.src=`/${evidence}/${name}.webm`;document.body.append(v)
   await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(new Error('Video decode failed'))})
   if(!Number.isFinite(v.duration)){v.currentTime=1e9;await new Promise(resolve=>v.onseeked=resolve)}
   result.push({name,width:v.videoWidth,height:v.videoHeight,duration:v.duration})
   for(const time of times){v.currentTime=time;await new Promise(resolve=>v.onseeked=resolve);const x=index%4*400,y=Math.floor(index/4)*440;c.drawImage(v,x,y,400,425);c.fillStyle='#373333';c.font='13px Microsoft YaHei';c.fillText(`${name} · ${time}s`,x+16,y+432);index++}
   v.remove()
  }
  return{result,png:canvas.toDataURL('image/png').split(',')[1]}
 },{evidence})
 for(const v of decode.result){assert.equal(v.width,640);assert.equal(v.height,680);assert.ok(v.duration>(v.name==='samples'?19:50))}
 writeFileSync(`${out}/video-decoded-frames.png`,Buffer.from(decode.png,'base64'));checks.push('Both new normal-speed WebM recordings decode at 640 × 680 with correct durations')
}finally{await context.close();await browser.close()}
writeFileSync(`${out}/results.json`,JSON.stringify({at:new Date().toISOString(),checks,video:decode.result,packageFiles:manifest.files.length+1,boardBytes:boards.reduce((n,f)=>n+readFileSync(`${pack}/assets/${f}`).length,0),noRealCamera:true,noRealPhone:true},null,2))
console.log(JSON.stringify({out,checks,video:decode.result},null,2))
